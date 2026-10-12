/** Reporte 1: volumen de respuestas por día/semana/mes, completitud y abandono. */

import { consultar, type Db, where } from "./comun";
import type { Filtros } from "./filtros";
import { type Celda, conteo, type Proporcion, proporcion } from "./supresion";

export type Granularidad = "dia" | "semana" | "mes";

export interface FilaVolumen {
  clave: string;
  total: Celda;
  completadas: Celda;
  abandonadas: Celda;
}

export interface ReporteVolumen {
  granularidad: Granularidad;
  series: FilaVolumen[];
  totales: { total: Celda; completadas: Celda; abandonadas: Celda; completitud: Proporcion };
  /** Ítem en el que más se abandona (solo si n >= umbral). */
  itemsAbandono: Array<{ item: string; n: Celda }>;
}

const EXPRESION: Record<Granularidad, string> = {
  dia: "creado_en",
  semana: "strftime('%Y-W%W', creado_en)",
  mes: "substr(creado_en, 1, 7)",
};

export async function reporteVolumen(
  db: Db,
  filtros: Filtros,
  granularidad: Granularidad = "dia",
): Promise<ReporteVolumen> {
  const w = where(filtros, { incluirIncompletas: true });
  const expresion = EXPRESION[granularidad];
  const filas = await consultar<{ clave: string; total: number; completadas: number }>(
    db,
    `SELECT ${expresion} AS clave, COUNT(*) AS total, SUM(completado) AS completadas
     FROM respuestas ${w.sql} GROUP BY clave ORDER BY clave`,
    w.params,
  );
  const series = filas.map((f) => ({
    clave: f.clave,
    total: conteo(f.total),
    completadas: conteo(f.completadas),
    abandonadas: conteo(f.total - f.completadas),
  }));
  const total = filas.reduce((a, f) => a + f.total, 0);
  const completadas = filas.reduce((a, f) => a + f.completadas, 0);

  const abandono = await consultar<{ item: string; n: number }>(
    db,
    `SELECT item_abandono AS item, COUNT(*) AS n FROM respuestas ${w.sql}
     AND completado = 0 AND item_abandono IS NOT NULL
     GROUP BY item_abandono ORDER BY n DESC, item LIMIT 10`,
    w.params,
  );
  return {
    granularidad,
    series,
    totales: {
      total: conteo(total),
      completadas: conteo(completadas),
      abandonadas: conteo(total - completadas),
      completitud: proporcion(completadas, total),
    },
    itemsAbandono: abandono.map((a) => ({ item: a.item, n: conteo(a.n) })),
  };
}
