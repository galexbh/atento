/** Reporte 10: histórico. Evolución mensual de n y % positivo; comparación entre años. */
import { consultar, type Db, SQL_POSITIVO, where } from "./comun";
import type { Filtros } from "./filtros";
import {
  type Celda,
  compararFilas,
  conteo,
  type FilaComparada,
  type Proporcion,
  proporcion,
} from "./supresion";

export interface FilaHistorica {
  clave: string;
  n: Celda;
  positivo: Proporcion;
}

export interface ReporteHistorico {
  mensual: FilaHistorica[];
  anual: FilaHistorica[];
  /** Diferencia entre los dos últimos años con datos (o los indicados por `comparar`). */
  comparacion: { periodoA: string; periodoB: string; filas: FilaComparada[] } | null;
}

export async function reporteHistorico(db: Db, filtros: Filtros): Promise<ReporteHistorico> {
  const w = where(filtros, { ignorarPeriodo: true });
  const [mensual, anual] = await Promise.all([
    consultar<{ clave: string; n: number; positivos: number }>(
      db,
      `SELECT substr(creado_en, 1, 7) AS clave, COUNT(*) AS n,
         SUM(CASE WHEN ${SQL_POSITIVO} THEN 1 ELSE 0 END) AS positivos
       FROM respuestas ${w.sql} GROUP BY clave ORDER BY clave`,
      w.params,
    ),
    consultar<{ clave: number; n: number; positivos: number }>(
      db,
      `SELECT periodo_anio AS clave, COUNT(*) AS n,
         SUM(CASE WHEN ${SQL_POSITIVO} THEN 1 ELSE 0 END) AS positivos
       FROM respuestas ${w.sql} GROUP BY clave ORDER BY clave`,
      w.params,
    ),
  ]);
  const aFila = (f: { clave: string | number; n: number; positivos: number }): FilaHistorica => ({
    clave: String(f.clave),
    n: conteo(f.n),
    positivo: proporcion(f.positivos, f.n),
  });
  const filasAnuales = anual.map(aFila);
  let comparacion: ReporteHistorico["comparacion"] = null;
  const anios = filasAnuales.map((f) => f.clave);
  let periodoA: string | undefined;
  let periodoB: string | undefined;
  if (filtros.comparar && /^\d{4}$/.test(filtros.periodo) && /^\d{4}$/.test(filtros.comparar)) {
    periodoA = filtros.periodo;
    periodoB = filtros.comparar;
  } else if (anios.length >= 2) {
    periodoA = anios[anios.length - 2];
    periodoB = anios[anios.length - 1];
  }
  if (periodoA && periodoB) {
    const a = filasAnuales
      .filter((f) => f.clave === periodoA)
      .map((f) => ({ ...f, clave: "anual" }));
    const b = filasAnuales
      .filter((f) => f.clave === periodoB)
      .map((f) => ({ ...f, clave: "anual" }));
    comparacion = {
      periodoA,
      periodoB,
      filas: compararFilas(a, b, "clave", ["n", "positivo"]),
    };
  }
  return { mensual: mensual.map(aFila), anual: filasAnuales, comparacion };
}
