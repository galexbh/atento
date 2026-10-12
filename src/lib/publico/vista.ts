/**
 * Formato y clases de color para la página pública /datos (es-HN). Puro: sin D1 ni DOM.
 */
import { listarDepartamentos } from "../catalogo/geo";
import {
  type Celda,
  type CeldaDepto,
  claseDiferencia,
  claseN,
  clasePct,
  type Publicacion,
  redondear1,
} from "./datos";

export type Modo = "pct" | "n" | "comparar";

/**
 * Texto único para toda celda suprimida (primaria o complementaria): distinguirlas revelaría
 * cuáles son pequeñas. El asterisco remite a la nota que explica la supresión complementaria.
 */
export const TEXTO_SUPRIMIDO = "menos de 5*";
export const NOTA_SUPRIMIDO =
  "* Menos de 5 respuestas, o dato protegido: algunas celdas con más respuestas también se ocultan para que no pueda deducirse una celda pequeña restando del total.";
export const TEXTO_SIN_RESPUESTAS = "sin respuestas";

const fmt1 = new Intl.NumberFormat("es-HN", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const fmtEnteroBase = new Intl.NumberFormat("es-HN", { maximumFractionDigits: 0 });

export function fmtEntero(n: number): string {
  return fmtEnteroBase.format(n);
}

export function fmtPct(p: number | null): string {
  return p === null ? "—" : `${fmt1.format(p)} %`;
}

export function fmtIc(ic: [number, number] | null): string {
  return ic ? `${fmt1.format(ic[0])}–${fmt1.format(ic[1])} %` : "—";
}

/** "+2,3 pp", "−1,0 pp", "0,0 pp". */
export function fmtPp(pp: number): string {
  const signo = pp > 0 ? "+" : pp < 0 ? "−" : "";
  return `${signo}${fmt1.format(Math.abs(pp))} pp`;
}

/** n publicado o "menos de 5" (suprimido) o "sin respuestas" (sin celda). */
export function textoN(c: Celda | undefined): string {
  if (!c) return TEXTO_SIN_RESPUESTAS;
  if (c.suprimido || c.n === null) return TEXTO_SUPRIMIDO;
  return fmtEntero(c.n);
}

export function fmtFecha(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("es-HN", { dateStyle: "medium", timeZone: "America/Tegucigalpa" });
}

/** Descripción completa de una celda para <title>, aria-label y la tarjeta de detalle. */
export function describirCelda(nombre: string, c: Celda | undefined): string {
  if (!c) return `${nombre}: sin respuestas`;
  if (c.suprimido)
    return `${nombre}: menos de 5 respuestas o dato protegido (suprimido por privacidad)`;
  return `${nombre}: ${textoN(c)} respuestas, ${fmtPct(c.pctIndicadores)} con indicadores (IC95 ${fmtIc(c.ic95)})`;
}

/** Diferencia en pp entre dos celdas visibles (a − b), o null si alguna falta o está suprimida. */
export function diferenciaPp(a: Celda | undefined, b: Celda | undefined): number | null {
  if (!a || !b || a.suprimido || b.suprimido) return null;
  if (a.pctIndicadores === null || b.pctIndicadores === null) return null;
  return redondear1(a.pctIndicadores - b.pctIndicadores);
}

/** Clase CSS de relleno del mapa para un departamento según el modo. */
export function claseRelleno(modo: Modo, a: Celda | undefined, b?: Celda | undefined): string {
  if (modo === "comparar") {
    if (!a || !b) return "dv-vacio";
    if (a.suprimido || b.suprimido) return "dv-suprimido";
    const pp = diferenciaPp(a, b);
    return pp === null ? "dv-suprimido" : `dv-dif-${claseDiferencia(pp)}`;
  }
  if (!a) return "dv-vacio";
  if (a.suprimido || a.n === null) return "dv-suprimido";
  if (modo === "n") return `dv-n-${claseN(a.n)}`;
  return a.pctIndicadores === null ? "dv-suprimido" : `dv-pct-${clasePct(a.pctIndicadores)}`;
}

export interface FilaDepto {
  codigo: string;
  nombre: string;
  celda: CeldaDepto | undefined;
  comparada: CeldaDepto | undefined;
  diferencia: number | null;
}

/** Los 18 departamentos en orden INE, con su celda (si tiene respuestas) y la comparada. */
export function filasDepartamentos(p: Publicacion, otra: Publicacion | null): FilaDepto[] {
  const propias = new Map(p.departamentos.map((d) => [d.codigo, d]));
  const ajenas = new Map((otra?.departamentos ?? []).map((d) => [d.codigo, d]));
  return listarDepartamentos().map((d) => {
    const celda = propias.get(d.codigo);
    const comparada = ajenas.get(d.codigo);
    return {
      codigo: d.codigo,
      nombre: d.nombre,
      celda,
      comparada,
      diferencia: diferenciaPp(celda, comparada),
    };
  });
}

/** Lee `modo` y `comparar` de la URL con valores seguros por defecto. */
export function leerControles(
  params: URLSearchParams,
  anio: number,
  aniosDisponibles: readonly number[],
): { modo: Modo; comparar: number | null } {
  const modoBruto = params.get("modo");
  let modo: Modo = modoBruto === "n" || modoBruto === "comparar" ? modoBruto : "pct";
  const otros = aniosDisponibles.filter((a) => a !== anio);
  const pedido = Number(params.get("comparar"));
  const comparar: number | null = otros.includes(pedido)
    ? pedido
    : (otros.find((a) => a < anio) ?? otros[0] ?? null);
  if (modo === "comparar" && comparar === null) modo = "pct";
  return { modo, comparar };
}
