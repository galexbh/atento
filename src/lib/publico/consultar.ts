/**
 * Lectura de D1 para la publicación pública: conteos agrupados (nunca filas individuales salen
 * de aquí) por departamento, municipio y trimestre de UN año.
 */
import type { FilaConteo } from "./datos";

/** Solo cribados completos con consentimiento de investigación. Un parámetro: el año. */
export const SQL_CONTEOS_ANIO = `SELECT departamento, municipio,
       ((CAST(substr(creado_en, 6, 2) AS INTEGER) - 1) / 3) + 1 AS trimestre,
       count(*) AS n,
       sum(CASE WHEN pos_inatencion = 1 OR pos_hiperactividad = 1 THEN 1 ELSE 0 END) AS n_pos,
       sum(CASE WHEN pos_inatencion = 1 THEN 1 ELSE 0 END) AS n_inat,
       sum(CASE WHEN pos_hiperactividad = 1 THEN 1 ELSE 0 END) AS n_hiper
FROM respuestas
WHERE periodo_anio = ? AND completado = 1 AND consentimiento_investigacion = 1
GROUP BY departamento, municipio, trimestre`;

export const SQL_ANIOS_CON_DATOS = `SELECT DISTINCT periodo_anio AS anio FROM respuestas
WHERE completado = 1 AND consentimiento_investigacion = 1 ORDER BY periodo_anio`;

export async function consultarConteosAnio(db: D1Database, anio: number): Promise<FilaConteo[]> {
  const { results } = await db.prepare(SQL_CONTEOS_ANIO).bind(anio).all<FilaConteo>();
  return results.map((f) => ({
    departamento: String(f.departamento),
    municipio: String(f.municipio),
    trimestre: Number(f.trimestre),
    n: Number(f.n),
    n_pos: Number(f.n_pos),
    n_inat: Number(f.n_inat),
    n_hiper: Number(f.n_hiper),
  }));
}

export async function consultarAniosConDatos(db: D1Database): Promise<number[]> {
  const { results } = await db.prepare(SQL_ANIOS_CON_DATOS).all<{ anio: number }>();
  return results.map((r) => Number(r.anio));
}
