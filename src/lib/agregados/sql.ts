/**
 * SQL compartido entre el cron (D1 `batch`) y `scripts/agregar-local.ts` (wrangler d1 execute).
 */
import type { FilaAgregado } from "./calcular";

/** Columnas en el orden de los parámetros de `sqlInsertarAgregados`. */
export const COLUMNAS_AGREGADO = [
  "periodo",
  "departamento",
  "municipio",
  "n",
  "pct_inatencion",
  "pct_hiperactividad",
  "pct_combinado",
  "pct_ambas",
  "ic95_inf",
  "ic95_sup",
  "suprimido",
  "version_instrumento",
  "calculado_en",
] as const;

/** Filas por sentencia: 13 columnas × 7 = 91 parámetros (D1 admite 100 por sentencia). */
export const FILAS_POR_SENTENCIA = 7;

/** SELECT con lo mínimo que necesita `agregar()`; solo cribados completados. */
export const SELECT_FILAS_PARA_AGREGAR =
  "SELECT creado_en, departamento, municipio, pos_inatencion, pos_hiperactividad, " +
  "version_instrumento FROM respuestas WHERE completado = 1";

export function parametrosAgregado(
  f: FilaAgregado,
  calculadoEn: string,
): (string | number | null)[] {
  return [
    f.periodo,
    f.departamento,
    f.municipio,
    f.n,
    f.pct_inatencion,
    f.pct_hiperactividad,
    f.pct_combinado,
    f.pct_ambas,
    f.ic95_inf,
    f.ic95_sup,
    f.suprimido,
    f.version_instrumento,
    calculadoEn,
  ];
}

/** `INSERT OR REPLACE` multi-fila con `cantidad` tuplas de marcadores `?`. */
export function sqlInsertarAgregados(cantidad: number): string {
  const tupla = `(${COLUMNAS_AGREGADO.map(() => "?").join(", ")})`;
  const tuplas = Array.from({ length: cantidad }, () => tupla).join(", ");
  return `INSERT OR REPLACE INTO agregados_municipio (${COLUMNAS_AGREGADO.join(", ")}) VALUES ${tuplas}`;
}

/** Elimina lo que no se reescribió en esta corrida (combinaciones que ya no tienen datos). */
export const SQL_BORRAR_OBSOLETOS = "DELETE FROM agregados_municipio WHERE calculado_en <> ?";

/** Snapshot anual (solo versión "todas": la PK de agregados_anuales no incluye la versión). */
export const SQL_SNAPSHOT_ANUAL = `INSERT OR IGNORE INTO agregados_anuales
  (periodo, departamento, municipio, n, pct_inatencion, pct_hiperactividad, pct_combinado, pct_ambas,
   ic95_inf, ic95_sup, suprimido, version_instrumento, version_dataset, calculado_en)
SELECT periodo, departamento, municipio, n, pct_inatencion, pct_hiperactividad, pct_combinado, pct_ambas,
       ic95_inf, ic95_sup, suprimido, version_instrumento, ?, ?
FROM agregados_municipio WHERE periodo = ? AND version_instrumento = ?`;

export const SQL_EXISTE_SNAPSHOT =
  "SELECT 1 AS existe FROM agregados_anuales WHERE periodo = ? AND version_dataset = ? LIMIT 1";

/** Divide un arreglo en trozos de tamaño fijo. */
export function trocear<T>(items: readonly T[], tamano: number): T[][] {
  const trozos: T[][] = [];
  for (let i = 0; i < items.length; i += tamano) trozos.push(items.slice(i, i + tamano));
  return trozos;
}

/** Literal SQL seguro para un valor (solo para los scripts locales que generan .sql). */
export function literalSql(v: string | number | null | undefined): string {
  if (v === null || v === undefined) return "NULL";
  if (typeof v === "number") return Number.isFinite(v) ? String(v) : "NULL";
  return `'${v.replace(/'/g, "''")}'`;
}
