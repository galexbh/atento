/** Reporte 4: puntajes. Histograma, descriptivos y percentiles por subescala; % por nivel. */
import type { Escala } from "../puntuacion/tipos";
import { consultar, type Db, ESCALAS_TODAS, rangosPuntaje, where } from "./comun";
import { type Bin, type Descriptivos, descriptivos, histograma, redondear } from "./estadistica";
import type { Filtros } from "./filtros";
import { type Celda, conteo, estaSuprimido, type Proporcion, proporcion } from "./supresion";

export interface PuntajeEscala {
  escala: Escala;
  n: number;
  suprimido: boolean;
  descriptivos: Descriptivos | null;
  histograma: Array<Bin & { celda: Celda }>;
}

export interface ReportePuntajes {
  escalas: PuntajeEscala[];
  niveles: Array<{ nivel: string; n: Celda; pct: Proporcion }>;
}

export async function reportePuntajes(db: Db, filtros: Filtros): Promise<ReportePuntajes> {
  const w = where(filtros);
  const columnas = ESCALAS_TODAS.map((e) => `punt_${e}`).join(", ");
  const [filas, niveles] = await Promise.all([
    consultar<Record<string, number | null>>(
      db,
      `SELECT ${columnas} FROM respuestas ${w.sql} LIMIT 50000`,
      w.params,
    ),
    consultar<{ nivel: string | null; n: number }>(
      db,
      `SELECT nivel, COUNT(*) AS n FROM respuestas ${w.sql} GROUP BY nivel`,
      w.params,
    ),
  ]);
  const rangos = rangosPuntaje(filtros.versionInstrumento);
  const escalas = ESCALAS_TODAS.map((escala): PuntajeEscala => {
    const valores = filas
      .map((f) => f[`punt_${escala}`])
      .filter((v): v is number => typeof v === "number");
    const rango = rangos[escala];
    const suprimido = estaSuprimido(valores.length);
    const d = suprimido ? null : descriptivos(valores);
    const desc = d
      ? {
          ...d,
          media: redondear(d.media, 2),
          de: redondear(d.de, 2),
          p10: redondear(d.p10, 1),
          p25: redondear(d.p25, 1),
          p75: redondear(d.p75, 1),
          p90: redondear(d.p90, 1),
        }
      : null;
    const bins = suprimido ? [] : histograma(valores, rango.min, rango.max, rango.ancho);
    return {
      escala,
      n: suprimido ? 0 : valores.length,
      suprimido,
      descriptivos: desc,
      histograma: bins.map((b) => ({ ...b, celda: conteo(b.n) })),
    };
  });
  const totalNiveles = niveles.reduce((a, f) => a + f.n, 0);
  const indice = new Map(niveles.map((f) => [f.nivel ?? "sin dato", f.n]));
  return {
    escalas,
    niveles: ["bajo", "moderado", "alto", "sin dato"].map((nivel) => {
      const n = indice.get(nivel) ?? 0;
      return { nivel, n: conteo(n), pct: proporcion(n, totalNiveles) };
    }),
  };
}
