/**
 * Lectura pública de `agregados_municipio` (nunca de filas individuales) con caché KV.
 */
import { z } from "zod";
import { claveCacheAgregado, TTL_CACHE_AGREGADOS_S } from "../api/cache";
import { obtenerDepartamento, obtenerMunicipio } from "../catalogo/geo";
import { VERSION_TODAS } from "./calcular";

export const EsquemaConsultaAgregado = z
  .object({
    periodo: z
      .string()
      .regex(/^(acumulado|\d{4}|\d{4}-Q[1-4]|\d{4}-(0[1-9]|1[0-2]))$/, "periodo inválido"),
    nivel: z.enum(["departamento", "municipio"]).default("departamento"),
    version: z
      .string()
      .regex(/^[a-z0-9][a-z0-9.-]{0,63}$/i, "version inválida")
      .default(VERSION_TODAS),
  })
  .strict();

export type ConsultaAgregado = z.infer<typeof EsquemaConsultaAgregado>;

export interface DatoAgregado {
  codigo: string;
  nombre: string;
  n: number;
  /** % con inatención o hiperactividad positiva (null si suprimido). */
  pct: number | null;
  ic95: [number, number] | null;
  suprimido: boolean;
  pctInatencion: number | null;
  pctHiperactividad: number | null;
  pctAmbas: number | null;
}

export interface RespuestaAgregado {
  periodo: string;
  nivel: "departamento" | "municipio";
  version: string;
  calculadoEn: string | null;
  datos: DatoAgregado[];
}

interface FilaBd {
  departamento: string;
  municipio: string;
  n: number;
  pct_inatencion: number | null;
  pct_hiperactividad: number | null;
  pct_combinado: number | null;
  pct_ambas: number | null;
  ic95_inf: number | null;
  ic95_sup: number | null;
  suprimido: number;
  calculado_en: string;
}

/** Lee el agregado desde D1 y lo serializa (cuerpo JSON como string, listo para KV). */
export async function consultarAgregado(db: D1Database, c: ConsultaAgregado): Promise<string> {
  const filtroNivel =
    c.nivel === "departamento"
      ? "substr(municipio, 3, 2) = '00'"
      : "substr(municipio, 3, 2) <> '00'";
  const { results } = await db
    .prepare(
      `SELECT departamento, municipio, n, pct_inatencion, pct_hiperactividad, pct_combinado,
              pct_ambas, ic95_inf, ic95_sup, suprimido, calculado_en
       FROM agregados_municipio
       WHERE periodo = ? AND version_instrumento = ? AND ${filtroNivel}
       ORDER BY municipio`,
    )
    .bind(c.periodo, c.version)
    .all<FilaBd>();

  let calculadoEn: string | null = null;
  const datos: DatoAgregado[] = results.map((f) => {
    if (calculadoEn === null || f.calculado_en > calculadoEn) calculadoEn = f.calculado_en;
    const codigo = c.nivel === "departamento" ? f.departamento : f.municipio;
    const nombre =
      c.nivel === "departamento"
        ? (obtenerDepartamento(f.departamento)?.nombre ?? f.departamento)
        : (obtenerMunicipio(f.municipio)?.nombre ?? f.municipio);
    const suprimido = f.suprimido === 1;
    return {
      codigo,
      nombre,
      n: f.n,
      pct: suprimido ? null : f.pct_combinado,
      ic95:
        suprimido || f.ic95_inf === null || f.ic95_sup === null ? null : [f.ic95_inf, f.ic95_sup],
      suprimido,
      pctInatencion: suprimido ? null : f.pct_inatencion,
      pctHiperactividad: suprimido ? null : f.pct_hiperactividad,
      pctAmbas: suprimido ? null : f.pct_ambas,
    };
  });

  const respuesta: RespuestaAgregado = {
    periodo: c.periodo,
    nivel: c.nivel,
    version: c.version,
    calculadoEn,
    datos,
  };
  return JSON.stringify(respuesta);
}

/** Igual que `consultarAgregado` pero pasando por la caché KV (TTL 1 h). */
export async function consultarAgregadoConCache(
  env: Pick<Env, "DB" | "CACHE">,
  c: ConsultaAgregado,
): Promise<{ cuerpo: string; desdeCache: boolean }> {
  const clave = claveCacheAgregado([c.periodo, c.nivel, c.version]);
  const cacheado = await env.CACHE.get(clave);
  if (cacheado !== null) return { cuerpo: cacheado, desdeCache: true };
  const cuerpo = await consultarAgregado(env.DB, c);
  await env.CACHE.put(clave, cuerpo, { expirationTtl: TTL_CACHE_AGREGADOS_S });
  return { cuerpo, desdeCache: false };
}

export interface PeriodosDisponibles {
  periodos: string[];
  versiones: string[];
  calculadoEn: string | null;
}

/** Periodos y versiones con agregados calculados (con caché KV). */
export async function listarPeriodos(
  env: Pick<Env, "DB" | "CACHE">,
): Promise<{ cuerpo: string; desdeCache: boolean }> {
  const clave = claveCacheAgregado(["periodos"]);
  const cacheado = await env.CACHE.get(clave);
  if (cacheado !== null) return { cuerpo: cacheado, desdeCache: true };
  const [periodos, versiones, fecha] = await env.DB.batch<Record<string, unknown>>([
    env.DB.prepare("SELECT DISTINCT periodo FROM agregados_municipio ORDER BY periodo"),
    env.DB.prepare(
      "SELECT DISTINCT version_instrumento FROM agregados_municipio ORDER BY version_instrumento",
    ),
    env.DB.prepare("SELECT max(calculado_en) AS fecha FROM agregados_municipio"),
  ]);
  const respuesta: PeriodosDisponibles = {
    periodos: (periodos?.results ?? []).map((r) => String(r.periodo)),
    versiones: (versiones?.results ?? []).map((r) => String(r.version_instrumento)),
    calculadoEn: (fecha?.results[0]?.fecha as string | null | undefined) ?? null,
  };
  const cuerpo = JSON.stringify(respuesta);
  await env.CACHE.put(clave, cuerpo, { expirationTtl: TTL_CACHE_AGREGADOS_S });
  return { cuerpo, desdeCache: false };
}
