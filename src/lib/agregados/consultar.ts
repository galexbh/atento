/**
 * Lectura pública de agregados para `/api/agregado` y `/api/agregado/periodos`.
 *
 * Endurecido: ya NO lee `agregados_municipio` (que tiene meses, trimestres, acumulado y
 * municipios sin supresión complementaria, lo que permitía reconstruir celdas suprimidas por
 * diferencia). Delega en la publicación segura anual (`src/lib/publico`), con la misma forma de
 * respuesta que antes salvo que `n` es `null` en las celdas suprimidas y `pctAmbas` ya no se
 * publica (siempre `null`). Solo se acepta `periodo` = año y `version` = "todas".
 */
import { z } from "zod";
import { type Celda, type Publicacion, VERSION_PRELIMINAR } from "../publico/datos";
import { listarAniosPublicadosJson, obtenerPublicacionJson } from "../publico/publicar";
import { VERSION_TODAS } from "./calcular";

export const EsquemaConsultaAgregado = z
  .object({
    periodo: z.string().regex(/^\d{4}$/, "periodo inválido: solo año calendario (AAAA)"),
    nivel: z.enum(["departamento", "municipio"]).default("departamento"),
    version: z.literal(VERSION_TODAS).default(VERSION_TODAS),
  })
  .strict();

export type ConsultaAgregado = z.infer<typeof EsquemaConsultaAgregado>;

export interface DatoAgregado {
  codigo: string;
  nombre: string;
  /** null si está suprimido. */
  n: number | null;
  /** % con inatención o hiperactividad positiva (null si suprimido). */
  pct: number | null;
  ic95: [number, number] | null;
  suprimido: boolean;
  pctInatencion: number | null;
  pctHiperactividad: number | null;
  /** Ya no se publica (siempre null); se mantiene por compatibilidad de forma. */
  pctAmbas: null;
}

export interface RespuestaAgregado {
  periodo: string;
  nivel: "departamento" | "municipio";
  version: string;
  versionDataset: string | null;
  preliminar: boolean | null;
  calculadoEn: string | null;
  datos: DatoAgregado[];
}

function dato(codigo: string, nombre: string, c: Celda): DatoAgregado {
  return {
    codigo,
    nombre,
    n: c.suprimido ? null : c.n,
    pct: c.pctIndicadores,
    ic95: c.ic95,
    suprimido: c.suprimido,
    pctInatencion: c.pctInatencion,
    pctHiperactividad: c.pctHiperactividad,
    pctAmbas: null,
  };
}

/** Respuesta con la forma histórica de `/api/agregado`, construida desde la publicación segura. */
export function respuestaDesdePublicacion(
  c: ConsultaAgregado,
  p: Publicacion | null,
): RespuestaAgregado {
  const datos = !p
    ? []
    : c.nivel === "departamento"
      ? p.departamentos.map((d) => dato(d.codigo, d.nombre, d))
      : p.municipios.map((m) => dato(m.codigo, m.nombre, m));
  return {
    periodo: c.periodo,
    nivel: c.nivel,
    version: c.version,
    versionDataset: p?.versionDataset ?? null,
    preliminar: p ? p.versionDataset === VERSION_PRELIMINAR : null,
    calculadoEn: p?.generadoEn ?? null,
    datos,
  };
}

export async function consultarAgregadoConCache(
  env: Pick<Env, "DB" | "CACHE">,
  c: ConsultaAgregado,
): Promise<{ cuerpo: string; desdeCache: boolean }> {
  const { cuerpo, desdeCache } = await obtenerPublicacionJson(env, Number(c.periodo));
  const p = cuerpo === null ? null : (JSON.parse(cuerpo) as Publicacion);
  return { cuerpo: JSON.stringify(respuestaDesdePublicacion(c, p)), desdeCache };
}

export interface PeriodosDisponibles {
  /** Solo años con publicación ("2025", "2026"). */
  periodos: string[];
  versiones: string[];
  calculadoEn: string | null;
}

/** Años publicados (con caché KV). */
export async function listarPeriodos(
  env: Pick<Env, "DB" | "CACHE">,
): Promise<{ cuerpo: string; desdeCache: boolean }> {
  const { cuerpo, desdeCache } = await listarAniosPublicadosJson(env);
  const { anios } = JSON.parse(cuerpo) as { anios: { anio: number; generadoEn: string }[] };
  const fechas = anios.map((a) => a.generadoEn).sort();
  const respuesta: PeriodosDisponibles = {
    periodos: anios.map((a) => String(a.anio)).sort(),
    versiones: [VERSION_TODAS],
    calculadoEn: fechas.at(-1) ?? null,
  };
  return { cuerpo: JSON.stringify(respuesta), desdeCache };
}
