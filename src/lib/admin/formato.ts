/** Formato de cifras para el panel (es-HN). Lo suprimido se muestra como "n < 5". */
import type { Celda, Proporcion } from "../reportes/supresion";

export const SUPRIMIDO = "n < 5";

const formatoEntero = new Intl.NumberFormat("es-HN", { maximumFractionDigits: 0 });
const formatoDecimal = new Intl.NumberFormat("es-HN", { maximumFractionDigits: 2 });

export function fmtEntero(n: number | null | undefined): string {
  return n === null || n === undefined ? "—" : formatoEntero.format(n);
}

export function fmtDecimal(n: number | null | undefined, decimales = 2): string {
  if (n === null || n === undefined) return "—";
  return new Intl.NumberFormat("es-HN", {
    minimumFractionDigits: decimales,
    maximumFractionDigits: decimales,
  }).format(n);
}

export function fmtCelda(c: Celda | null | undefined): string {
  if (!c) return "—";
  return c.suprimido ? SUPRIMIDO : formatoEntero.format(c.n);
}

/** "12,3 %" o "n < 5". */
export function fmtPct(p: Proporcion | null | undefined): string {
  if (!p) return "—";
  if (p.suprimido || p.pct === null) return SUPRIMIDO;
  return `${formatoDecimal.format(p.pct)} %`;
}

/** "12,3 % (IC95 8,1–17,9)". */
export function fmtPctIc(p: Proporcion | null | undefined): string {
  if (!p || p.suprimido || p.pct === null) return SUPRIMIDO;
  const base = `${formatoDecimal.format(p.pct)} %`;
  if (!p.ic95) return base;
  return `${base} (IC95 ${formatoDecimal.format(p.ic95.inferior)}–${formatoDecimal.format(p.ic95.superior)})`;
}

export function fmtFechaHora(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("es-HN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/Tegucigalpa",
  });
}

/** Clase de color del mapa para un % positivo (escala fija de 5 clases). */
export function claseMapa(p: Proporcion, n: number): "vacio" | "suprimido" | 1 | 2 | 3 | 4 | 5 {
  if (n === 0 && !p.suprimido) return "vacio";
  if (p.suprimido || p.pct === null) return "suprimido";
  if (p.pct < 5) return 1;
  if (p.pct < 10) return 2;
  if (p.pct < 15) return 3;
  if (p.pct < 20) return 4;
  return 5;
}

export const ETIQUETAS_CLASE_MAPA: Record<1 | 2 | 3 | 4 | 5, string> = {
  1: "< 5 %",
  2: "5–10 %",
  3: "10–15 %",
  4: "15–20 %",
  5: "≥ 20 %",
};
