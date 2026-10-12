/** Resumen de portada del panel: totales, % positivo, completitud y últimos 30 días. */
import { consultar, consultarUna, type Db, SQL_POSITIVO, where } from "./comun";
import type { Filtros } from "./filtros";
import { type Celda, conteo, type Proporcion, proporcion } from "./supresion";

export interface ReporteResumen {
  /** Conteos suprimidos (n < 5) como cualquier otra celda. */
  nTotalHistorico: Celda;
  nPeriodo: Celda;
  completitud: Proporcion;
  positivo: Proporcion;
  combinado: Proporcion;
  consentimiento: Proporcion;
  /** Respuestas completadas por día en los últimos 30 días (incluye días sin datos). */
  ultimos30: Array<{ fecha: string; n: Celda }>;
  ultimaAgregacion: string | null;
}

export async function reporteResumen(db: Db, filtros: Filtros): Promise<ReporteResumen> {
  const w = where(filtros, { incluirIncompletas: true });
  const hoy = new Date();
  const desde = new Date(hoy.getTime() - 29 * 86_400_000).toISOString().slice(0, 10);
  const [total, periodo, diarios, agregacion] = await Promise.all([
    consultarUna<{ n: number }>(db, "SELECT COUNT(*) AS n FROM respuestas WHERE completado = 1"),
    consultarUna<{
      n: number;
      completadas: number;
      positivos: number;
      combinados: number;
      consentimiento: number;
    }>(
      db,
      `SELECT COUNT(*) AS n, SUM(completado) AS completadas,
         SUM(CASE WHEN completado = 1 AND ${SQL_POSITIVO} THEN 1 ELSE 0 END) AS positivos,
         SUM(CASE WHEN completado = 1 AND COALESCE(pos_inatencion,0) = 1 AND COALESCE(pos_hiperactividad,0) = 1 THEN 1 ELSE 0 END) AS combinados,
         SUM(CASE WHEN completado = 1 AND consentimiento_investigacion = 1 THEN 1 ELSE 0 END) AS consentimiento
       FROM respuestas ${w.sql}`,
      w.params,
    ),
    consultar<{ fecha: string; n: number }>(
      db,
      `SELECT creado_en AS fecha, COUNT(*) AS n FROM respuestas
       WHERE completado = 1 AND creado_en >= ? GROUP BY creado_en`,
      [desde],
    ),
    consultarUna<{ calculado_en: string }>(
      db,
      "SELECT MAX(calculado_en) AS calculado_en FROM agregados_municipio",
    ).catch(() => null),
  ]);
  const indice = new Map(diarios.map((d) => [d.fecha, d.n]));
  const ultimos30: ReporteResumen["ultimos30"] = [];
  for (let i = 29; i >= 0; i--) {
    const fecha = new Date(hoy.getTime() - i * 86_400_000).toISOString().slice(0, 10);
    ultimos30.push({ fecha, n: conteo(indice.get(fecha) ?? 0) });
  }
  const p = periodo ?? { n: 0, completadas: 0, positivos: 0, combinados: 0, consentimiento: 0 };
  return {
    nTotalHistorico: conteo(total?.n ?? 0),
    nPeriodo: conteo(p.completadas ?? 0),
    completitud: proporcion(p.completadas ?? 0, p.n),
    positivo: proporcion(p.positivos ?? 0, p.completadas ?? 0),
    combinado: proporcion(p.combinados ?? 0, p.completadas ?? 0),
    consentimiento: proporcion(p.consentimiento ?? 0, p.completadas ?? 0),
    ultimos30,
    ultimaAgregacion: agregacion?.calculado_en ?? null,
  };
}
