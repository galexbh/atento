/**
 * Recalcula `agregados_municipio` desde `respuestas` (cron diario y acción admin).
 *
 * Estrategia: se escriben las filas nuevas con `INSERT OR REPLACE` (mismo `calculado_en` para
 * toda la corrida) en lotes `batch` (cada lote es atómico) y al final se borran las filas cuyo
 * `calculado_en` sea distinto. Así los lectores siempre encuentran filas y no hace falta una
 * transacción gigante. Después se invalida la caché KV (`agregado:*`).
 */
import { invalidarCacheAgregados } from "../api/cache";
import { agregar, type FilaRespuesta, VERSION_TODAS } from "./calcular";
import {
  FILAS_POR_SENTENCIA,
  parametrosAgregado,
  SELECT_FILAS_PARA_AGREGAR,
  SQL_BORRAR_OBSOLETOS,
  SQL_EXISTE_SNAPSHOT,
  SQL_SNAPSHOT_ANUAL,
  sqlInsertarAgregados,
  trocear,
} from "./sql";

/** Sentencias por `batch` de D1. */
const SENTENCIAS_POR_LOTE = 40;
export const VERSION_DATASET_ACTUAL = "v1";

export interface ResultadoRecalculo {
  filasLeidas: number;
  agregadosEscritos: number;
  calculadoEn: string;
  ms: number;
}

type EnvAgregados = Pick<Env, "DB" | "CACHE">;

export async function recalcularAgregados(
  env: EnvAgregados,
  ahora: Date = new Date(),
): Promise<ResultadoRecalculo> {
  const inicio = Date.now();
  const calculadoEn = ahora.toISOString();

  const { results } = await env.DB.prepare(SELECT_FILAS_PARA_AGREGAR).all<FilaRespuesta>();
  const agregados = agregar(results);

  const sentencias = trocear(agregados, FILAS_POR_SENTENCIA).map((grupo) =>
    env.DB.prepare(sqlInsertarAgregados(grupo.length)).bind(
      ...grupo.flatMap((f) => parametrosAgregado(f, calculadoEn)),
    ),
  );
  for (const lote of trocear(sentencias, SENTENCIAS_POR_LOTE)) {
    await env.DB.batch(lote);
  }
  await env.DB.prepare(SQL_BORRAR_OBSOLETOS).bind(calculadoEn).run();
  await invalidarCacheAgregados(env.CACHE);

  return {
    filasLeidas: results.length,
    agregadosEscritos: agregados.length,
    calculadoEn,
    ms: Date.now() - inicio,
  };
}

/**
 * Crea el snapshot anual (dataset abierto) del año indicado si aún no existe.
 * Devuelve verdadero si se creó.
 */
export async function crearSnapshotAnual(
  env: Pick<Env, "DB">,
  anio: number,
  versionDataset = VERSION_DATASET_ACTUAL,
  ahora: Date = new Date(),
): Promise<boolean> {
  const periodo = String(anio);
  const existe = await env.DB.prepare(SQL_EXISTE_SNAPSHOT).bind(periodo, versionDataset).first();
  if (existe) return false;
  await env.DB.prepare(SQL_SNAPSHOT_ANUAL)
    .bind(versionDataset, ahora.toISOString(), periodo, VERSION_TODAS)
    .run();
  return true;
}

/** Tarea del cron diario: recalcular y, el 1 de enero, congelar el año anterior. */
export async function ejecutarCronDiario(env: EnvAgregados, ahora: Date = new Date()) {
  const resultado = await recalcularAgregados(env, ahora);
  let snapshot: number | null = null;
  if (ahora.getUTCMonth() === 0 && ahora.getUTCDate() === 1) {
    const anioAnterior = ahora.getUTCFullYear() - 1;
    if (await crearSnapshotAnual(env, anioAnterior, VERSION_DATASET_ACTUAL, ahora)) {
      snapshot = anioAnterior;
    }
  }
  return { ...resultado, snapshot };
}
