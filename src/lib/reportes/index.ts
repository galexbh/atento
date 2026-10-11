/** Registro de reportes por nombre (para /api/admin/reporte/[nombre] y exportaciones). */
import { reporteCalidad } from "./calidad";
import { reporteComorbilidad } from "./comorbilidad";
import type { Db } from "./comun";
import { reporteDemografia } from "./demografia";
import { reporteDesempeno } from "./desempeno";
import type { Filtros } from "./filtros";
import { reporteGeografia } from "./geografia";
import { reporteHistorico } from "./historico";
import { reporteInvestigacion } from "./investigacion";
import { reportePsicometria } from "./psicometria";
import { reportePuntajes } from "./puntajes";
import { reporteResumen } from "./resumen";
import { UMBRAL_SUPRESION } from "./supresion";
import { type Granularidad, reporteVolumen } from "./volumen";

export const NOMBRES_REPORTE = [
  "resumen",
  "volumen",
  "geografia",
  "demografia",
  "puntajes",
  "comorbilidad",
  "desempeno",
  "psicometria",
  "calidad",
  "investigacion",
  "historico",
] as const;

export type NombreReporte = (typeof NOMBRES_REPORTE)[number];

export function esNombreReporte(valor: string): valor is NombreReporte {
  return (NOMBRES_REPORTE as readonly string[]).includes(valor);
}

export interface OpcionesReporte {
  granularidad?: Granularidad;
}

export async function ejecutarReporte(
  db: Db,
  nombre: NombreReporte,
  filtros: Filtros,
  opciones: OpcionesReporte = {},
): Promise<unknown> {
  switch (nombre) {
    case "resumen":
      return reporteResumen(db, filtros);
    case "volumen":
      return reporteVolumen(db, filtros, opciones.granularidad ?? "dia");
    case "geografia":
      return reporteGeografia(db, filtros);
    case "demografia":
      return reporteDemografia(db, filtros);
    case "puntajes":
      return reportePuntajes(db, filtros);
    case "comorbilidad":
      return reporteComorbilidad(db, filtros);
    case "desempeno":
      return reporteDesempeno(db, filtros);
    case "psicometria":
      return reportePsicometria(db, filtros);
    case "calidad":
      return reporteCalidad(db, filtros);
    case "investigacion":
      return reporteInvestigacion(db, filtros);
    case "historico":
      return reporteHistorico(db, filtros);
  }
}

/** Envoltorio con metadatos (versión, fecha, filtros) para respuestas JSON y exportaciones. */
export async function reporteConMeta(
  db: Db,
  nombre: NombreReporte,
  filtros: Filtros,
  opciones: OpcionesReporte = {},
) {
  const datos = await ejecutarReporte(db, nombre, filtros, opciones);
  return {
    meta: {
      reporte: nombre,
      periodo: filtros.periodo,
      filtros,
      generadoEn: new Date().toISOString(),
      umbralSupresion: UMBRAL_SUPRESION,
      nota: "Cribado comunitario, no diagnóstico. Celdas con n < 5 suprimidas (null).",
    },
    datos,
  };
}
