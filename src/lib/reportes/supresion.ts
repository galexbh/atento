/**
 * Supresión de celdas pequeñas y comparación entre periodos.
 *
 * Regla del proyecto: cualquier celda con n < 5 se publica como `null` y `suprimido: true`
 * para evitar reidentificación en municipios o cruces pequeños.
 */
import { redondear, wilson } from "./estadistica";

export const UMBRAL_SUPRESION = 5;

export interface Celda {
  n: number;
  suprimido: boolean;
}

export interface Proporcion extends Celda {
  /** Porcentaje 0-100 con un decimal, o null si está suprimido. */
  pct: number | null;
  ic95: { inferior: number; superior: number } | null;
}

export function estaSuprimido(n: number): boolean {
  return n < UMBRAL_SUPRESION;
}

/** Conteo: si n < umbral se devuelve n = 0 y suprimido = true (el conteo exacto no se expone). */
export function conteo(n: number): Celda {
  return estaSuprimido(n) ? { n: 0, suprimido: true } : { n, suprimido: false };
}

/** Proporción con IC95 de Wilson; suprimida si el denominador es pequeño. */
export function proporcion(exitos: number, n: number): Proporcion {
  if (estaSuprimido(n)) return { n: 0, suprimido: true, pct: null, ic95: null };
  const ic = wilson(exitos, n);
  return {
    n,
    suprimido: false,
    pct: redondear((exitos / n) * 100, 1),
    ic95: ic
      ? {
          inferior: redondear(ic.inferior * 100, 1) as number,
          superior: redondear(ic.superior * 100, 1) as number,
        }
      : null,
  };
}

/** Valor que solo se expone si n alcanza el umbral. */
export function valorSuprimible<T>(n: number, valor: T): Celda & { valor: T | null } {
  return estaSuprimido(n) ? { n: 0, valor: null, suprimido: true } : { n, valor, suprimido: false };
}

export interface Diferencia {
  a: number | null;
  b: number | null;
  absoluta: number | null;
  /** Variación relativa en % respecto de `a` (null si `a` es 0 o falta). */
  relativa: number | null;
}

export function diferencia(a: number | null, b: number | null): Diferencia {
  if (a === null || b === null) return { a, b, absoluta: null, relativa: null };
  const absoluta = redondear(b - a, 1);
  const relativa = a === 0 ? null : redondear(((b - a) / Math.abs(a)) * 100, 1);
  return { a, b, absoluta, relativa };
}

export interface FilaComparada {
  clave: string;
  diferencias: Record<string, Diferencia>;
}

/**
 * Compara dos listas de filas por clave, calculando diferencias en los campos indicados.
 * Acepta números, celdas `{n, suprimido}` y proporciones `{pct}`; lo suprimido produce null.
 */
export function compararFilas<T extends Record<string, unknown>>(
  filasA: readonly T[],
  filasB: readonly T[],
  clave: keyof T,
  campos: readonly (keyof T)[],
): FilaComparada[] {
  const indiceA = new Map(filasA.map((f) => [String(f[clave]), f]));
  const indiceB = new Map(filasB.map((f) => [String(f[clave]), f]));
  const claves = [...new Set([...indiceA.keys(), ...indiceB.keys()])].sort();
  return claves.map((k) => {
    const a = indiceA.get(k);
    const b = indiceB.get(k);
    const diferencias: Record<string, Diferencia> = {};
    for (const campo of campos) {
      diferencias[String(campo)] = diferencia(leerNumero(a?.[campo]), leerNumero(b?.[campo]));
    }
    return { clave: k, diferencias };
  });
}

export function leerNumero(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (v && typeof v === "object") {
    if ("pct" in v) {
      const pct = (v as { pct: unknown }).pct;
      return typeof pct === "number" ? pct : null;
    }
    if ("suprimido" in v && "n" in v) {
      const celda = v as Celda;
      return celda.suprimido ? null : celda.n;
    }
  }
  return null;
}
