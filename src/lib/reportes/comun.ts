/**
 * Utilidades compartidas por los reportes: acceso a D1, escalas y definición de "positivo".
 *
 * Definiciones (documentadas también en el codebook):
 * - "cribado positivo" = inatención positiva O hiperactividad positiva.
 * - "combinado" = inatención Y hiperactividad positivas.
 */
import type { Escala } from "../puntuacion/tipos";
import { construirWhere, type Filtros, type OpcionesWhere } from "./filtros";

export const ESCALAS_SINTOMAS = [
  "inatencion",
  "hiperactividad",
  "oposicion",
  "conducta",
  "ansiedad_depresion",
] as const satisfies readonly Escala[];

export const ESCALAS_TODAS = [
  ...ESCALAS_SINTOMAS,
  "desempeno",
] as const satisfies readonly Escala[];

export const ETIQUETA_ESCALA: Record<Escala, string> = {
  inatencion: "Inatención",
  hiperactividad: "Hiperactividad/impulsividad",
  oposicion: "Oposición desafiante",
  conducta: "Conducta",
  ansiedad_depresion: "Ansiedad/depresión",
  desempeno: "Desempeño",
};

/** Rango teórico del puntaje de cada escala (Vanderbilt padres). */
export const RANGO_PUNTAJE: Record<Escala, { max: number; ancho: number }> = {
  inatencion: { max: 27, ancho: 3 },
  hiperactividad: { max: 27, ancho: 3 },
  oposicion: { max: 24, ancho: 3 },
  conducta: { max: 42, ancho: 6 },
  ansiedad_depresion: { max: 21, ancho: 3 },
  desempeno: { max: 35, ancho: 5 },
};

export const SQL_POSITIVO =
  "(COALESCE(pos_inatencion, 0) = 1 OR COALESCE(pos_hiperactividad, 0) = 1)";
export const SQL_COMBINADO =
  "(COALESCE(pos_inatencion, 0) = 1 AND COALESCE(pos_hiperactividad, 0) = 1)";

export type Db = D1Database;

export async function consultar<T>(
  db: Db,
  sql: string,
  params: readonly (string | number)[] = [],
): Promise<T[]> {
  const resultado = await db
    .prepare(sql)
    .bind(...params)
    .all<T>();
  return resultado.results;
}

export async function consultarUna<T>(
  db: Db,
  sql: string,
  params: readonly (string | number)[] = [],
): Promise<T | null> {
  return db
    .prepare(sql)
    .bind(...params)
    .first<T>();
}

/** `WHERE ...` listo para concatenar. */
export function where(filtros: Filtros, opciones?: OpcionesWhere) {
  const w = construirWhere(filtros, opciones);
  return { sql: `WHERE ${w.sql}`, params: w.params };
}

/** Fila de `respuestas` con el JSON de ítems ya parseado. */
export interface FilaItems {
  id: string;
  version_instrumento: string;
  items: Record<string, number>;
  pos_inatencion: number | null;
  pos_hiperactividad: number | null;
  nivel: string | null;
}

/** Lee las filas con sus ítems (para psicometría, desempeño y calidad). Límite de seguridad. */
export async function leerFilasConItems(
  db: Db,
  filtros: Filtros,
  limite = 20_000,
): Promise<FilaItems[]> {
  const w = where(filtros);
  const filas = await consultar<Omit<FilaItems, "items"> & { items: string }>(
    db,
    `SELECT id, version_instrumento, items, pos_inatencion, pos_hiperactividad, nivel
     FROM respuestas ${w.sql} ORDER BY creado_en LIMIT ${limite}`,
    w.params,
  );
  return filas.map((f) => ({ ...f, items: parsearItems(f.items) }));
}

export function parsearItems(texto: string): Record<string, number> {
  try {
    const obj = JSON.parse(texto) as unknown;
    if (!obj || typeof obj !== "object") return {};
    const salida: Record<string, number> = {};
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      if (typeof v === "number" && Number.isFinite(v)) salida[k] = v;
    }
    return salida;
  } catch {
    return {};
  }
}

export interface MetaReporte {
  reporte: string;
  periodo: string;
  filtros: Filtros;
  generadoEn: string;
  umbralSupresion: number;
}
