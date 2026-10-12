/** Reporte 5: comorbilidad. Co-ocurrencia de positivos entre las 5 subescalas de síntomas. */
import { consultar, type Db, ESCALAS_SINTOMAS, where } from "./comun";
import type { Filtros } from "./filtros";
import { type Celda, conteo, type Proporcion, proporcion } from "./supresion";

export type EscalaSintoma = (typeof ESCALAS_SINTOMAS)[number];

export interface ReporteComorbilidad {
  n: Celda;
  escalas: readonly EscalaSintoma[];
  /** matriz[a][b] = n con a y b positivas (diagonal = n positivos de a). */
  matriz: Record<EscalaSintoma, Record<EscalaSintoma, Celda>>;
  /** pct[a][b] = % de positivos en a que también son positivos en b. */
  pct: Record<EscalaSintoma, Record<EscalaSintoma, Proporcion>>;
  /** Número de subescalas positivas por respuesta (0..5). */
  porCantidad: Array<{ cantidad: number; n: Celda; pct: Proporcion }>;
}

export async function reporteComorbilidad(db: Db, filtros: Filtros): Promise<ReporteComorbilidad> {
  const w = where(filtros);
  const sumas: string[] = [];
  for (const a of ESCALAS_SINTOMAS) {
    for (const b of ESCALAS_SINTOMAS) {
      sumas.push(`SUM(COALESCE(pos_${a}, 0) * COALESCE(pos_${b}, 0)) AS "${a}__${b}"`);
    }
  }
  const sumaPos = ESCALAS_SINTOMAS.map((e) => `COALESCE(pos_${e}, 0)`).join(" + ");
  const [fila, cantidades] = await Promise.all([
    consultar<Record<string, number>>(
      db,
      `SELECT COUNT(*) AS n, ${sumas.join(", ")} FROM respuestas ${w.sql}`,
      w.params,
    ),
    consultar<{ cantidad: number; n: number }>(
      db,
      `SELECT (${sumaPos}) AS cantidad, COUNT(*) AS n FROM respuestas ${w.sql}
       GROUP BY cantidad ORDER BY cantidad`,
      w.params,
    ),
  ]);
  const f = fila[0] ?? { n: 0 };
  const n = f.n ?? 0;
  const matriz = {} as ReporteComorbilidad["matriz"];
  const pct = {} as ReporteComorbilidad["pct"];
  for (const a of ESCALAS_SINTOMAS) {
    matriz[a] = {} as Record<EscalaSintoma, Celda>;
    pct[a] = {} as Record<EscalaSintoma, Proporcion>;
    const nA = f[`${a}__${a}`] ?? 0;
    for (const b of ESCALAS_SINTOMAS) {
      const nAB = f[`${a}__${b}`] ?? 0;
      matriz[a][b] = conteo(nAB);
      pct[a][b] = proporcion(nAB, nA);
    }
  }
  const indice = new Map(cantidades.map((c) => [c.cantidad, c.n]));
  const porCantidad = [0, 1, 2, 3, 4, 5].map((cantidad) => {
    const k = indice.get(cantidad) ?? 0;
    return { cantidad, n: conteo(k), pct: proporcion(k, n) };
  });
  return { n: conteo(n), escalas: ESCALAS_SINTOMAS, matriz, pct, porCantidad };
}
