/**
 * Reporte 8: calidad de datos.
 * - Patrón "todo igual": todos los ítems de frecuencia con el mismo valor.
 * - Duración < 120 s.
 * - Duplicados sospechosos: mismo día + municipio + edad + sexo + ítems idénticos.
 */
import { consultar, consultarUna, type Db, leerFilasConItems, where } from "./comun";
import type { Filtros } from "./filtros";
import { type Celda, conteo, type Proporcion, proporcion } from "./supresion";

export interface ReporteCalidad {
  n: Celda;
  todoIgual: Proporcion;
  rapidas: Proporcion;
  sinDuracion: Celda;
  /** Grupos duplicados y filas implicadas. */
  duplicados: { grupos: Celda; filas: Celda; pct: Proporcion };
  /** Duración mediana aproximada (segundos) de las respuestas completas. */
  duracion: { p25: number | null; p50: number | null; p75: number | null };
}

export function esTodoIgual(items: Record<string, number>): boolean {
  const valores = Object.entries(items)
    .filter(([id]) => /^[VA]\d{2}$/.test(id) && !/^V(48|49|5\d)$/.test(id))
    .map(([, v]) => v);
  if (valores.length < 5) return false;
  return valores.every((v) => v === valores[0]);
}

export async function reporteCalidad(db: Db, filtros: Filtros): Promise<ReporteCalidad> {
  const w = where(filtros);
  const [filas, rapidas, duplicados, duraciones] = await Promise.all([
    leerFilasConItems(db, filtros),
    consultarUna<{ n: number; rapidas: number; sin_duracion: number }>(
      db,
      `SELECT COUNT(*) AS n,
         SUM(CASE WHEN duracion_segundos IS NOT NULL AND duracion_segundos < 120 THEN 1 ELSE 0 END) AS rapidas,
         SUM(CASE WHEN duracion_segundos IS NULL THEN 1 ELSE 0 END) AS sin_duracion
       FROM respuestas ${w.sql}`,
      w.params,
    ),
    consultar<{ repeticiones: number }>(
      db,
      `SELECT COUNT(*) AS repeticiones FROM respuestas ${w.sql}
       GROUP BY creado_en, municipio, edad_anios, sexo, items HAVING COUNT(*) > 1`,
      w.params,
    ),
    consultar<{ duracion_segundos: number }>(
      db,
      `SELECT duracion_segundos FROM respuestas ${w.sql} AND duracion_segundos IS NOT NULL
       ORDER BY duracion_segundos`,
      w.params,
    ),
  ]);
  const n = rapidas?.n ?? 0;
  const todoIgual = filas.filter((f) => esTodoIgual(f.items)).length;
  const filasDuplicadas = duplicados.reduce((a, d) => a + d.repeticiones, 0);
  const valores = duraciones.map((d) => d.duracion_segundos);
  const cuantil = (p: number): number | null => {
    if (valores.length < 5) return null;
    const idx = Math.min(valores.length - 1, Math.floor(p * (valores.length - 1)));
    return valores[idx] ?? null;
  };
  return {
    n: conteo(n),
    todoIgual: proporcion(todoIgual, filas.length),
    rapidas: proporcion(rapidas?.rapidas ?? 0, n),
    sinDuracion: conteo(rapidas?.sin_duracion ?? 0),
    duplicados: {
      grupos: conteo(duplicados.length),
      filas: conteo(filasDuplicadas),
      pct: proporcion(filasDuplicadas, n),
    },
    duracion: { p25: cuantil(0.25), p50: cuantil(0.5), p75: cuantil(0.75) },
  };
}
