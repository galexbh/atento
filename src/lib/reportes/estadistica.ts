/**
 * Estadística descriptiva y psicométrica en TypeScript puro (sin dependencias).
 *
 * Todas las funciones aceptan arreglos de números finitos; devuelven `null` cuando el cálculo
 * no está definido (muestra vacía, varianza cero, etc.) en lugar de NaN.
 */

export function media(valores: readonly number[]): number | null {
  if (valores.length === 0) return null;
  let suma = 0;
  for (const v of valores) suma += v;
  return suma / valores.length;
}

/** Varianza muestral (divisor n-1). */
export function varianza(valores: readonly number[]): number | null {
  if (valores.length < 2) return null;
  const m = media(valores) as number;
  let acum = 0;
  for (const v of valores) acum += (v - m) ** 2;
  return acum / (valores.length - 1);
}

/** Desviación estándar muestral. */
export function desviacion(valores: readonly number[]): number | null {
  const v = varianza(valores);
  return v === null ? null : Math.sqrt(v);
}

/**
 * Percentil con interpolación lineal (tipo 7 de Hyndman & Fan, el de R y NumPy por defecto).
 * @param p entre 0 y 100.
 */
export function percentil(valores: readonly number[], p: number): number | null {
  if (valores.length === 0) return null;
  const ordenados = [...valores].sort((a, b) => a - b);
  const pos = (ordenados.length - 1) * (p / 100);
  const inferior = Math.floor(pos);
  const superior = Math.ceil(pos);
  const vi = ordenados[inferior] as number;
  const vs = ordenados[superior] as number;
  return vi + (vs - vi) * (pos - inferior);
}

export function mediana(valores: readonly number[]): number | null {
  return percentil(valores, 50);
}

export interface Descriptivos {
  n: number;
  media: number | null;
  mediana: number | null;
  de: number | null;
  p10: number | null;
  p25: number | null;
  p50: number | null;
  p75: number | null;
  p90: number | null;
  min: number | null;
  max: number | null;
}

export function descriptivos(valores: readonly number[]): Descriptivos {
  return {
    n: valores.length,
    media: media(valores),
    mediana: mediana(valores),
    de: desviacion(valores),
    p10: percentil(valores, 10),
    p25: percentil(valores, 25),
    p50: percentil(valores, 50),
    p75: percentil(valores, 75),
    p90: percentil(valores, 90),
    min: valores.length ? Math.min(...valores) : null,
    max: valores.length ? Math.max(...valores) : null,
  };
}

/** Correlación de Pearson entre dos series emparejadas. */
export function pearson(x: readonly number[], y: readonly number[]): number | null {
  const n = Math.min(x.length, y.length);
  if (n < 2) return null;
  let sx = 0;
  let sy = 0;
  for (let i = 0; i < n; i++) {
    sx += x[i] as number;
    sy += y[i] as number;
  }
  const mx = sx / n;
  const my = sy / n;
  let sxy = 0;
  let sxx = 0;
  let syy = 0;
  for (let i = 0; i < n; i++) {
    const dx = (x[i] as number) - mx;
    const dy = (y[i] as number) - my;
    sxy += dx * dy;
    sxx += dx * dx;
    syy += dy * dy;
  }
  if (sxx === 0 || syy === 0) return null;
  return sxy / Math.sqrt(sxx * syy);
}

/**
 * Alfa de Cronbach. `matriz[i]` es la fila de respuestas del sujeto i; cada fila tiene k ítems.
 * Requiere al menos 2 ítems y 2 sujetos.
 */
export function alfaCronbach(matriz: readonly (readonly number[])[]): number | null {
  const n = matriz.length;
  if (n < 2) return null;
  const k = matriz[0]?.length ?? 0;
  if (k < 2) return null;
  let sumaVarianzasItems = 0;
  for (let j = 0; j < k; j++) {
    const v = varianza(matriz.map((fila) => fila[j] as number));
    if (v === null) return null;
    sumaVarianzasItems += v;
  }
  const totales = matriz.map((fila) => fila.reduce((a, b) => a + b, 0));
  const varTotal = varianza(totales);
  if (varTotal === null || varTotal === 0) return null;
  return (k / (k - 1)) * (1 - sumaVarianzasItems / varTotal);
}

/** Correlación de cada ítem con la suma de los demás (ítem-total corregida). */
export function correlacionItemTotalCorregida(
  matriz: readonly (readonly number[])[],
  indiceItem: number,
): number | null {
  const item = matriz.map((fila) => fila[indiceItem] as number);
  const resto = matriz.map((fila) =>
    fila.reduce((acum, v, j) => (j === indiceItem ? acum : acum + v), 0),
  );
  return pearson(item, resto);
}

/** Alfa de la escala si se elimina el ítem indicado. */
export function alfaSinItem(
  matriz: readonly (readonly number[])[],
  indiceItem: number,
): number | null {
  const reducida = matriz.map((fila) => fila.filter((_, j) => j !== indiceItem));
  return alfaCronbach(reducida);
}

/**
 * Intervalo de confianza de Wilson para una proporción (z = 1.96 -> 95 %).
 * Devuelve límites en [0, 1].
 */
export function wilson(
  exitos: number,
  n: number,
  z = 1.96,
): { inferior: number; superior: number } | null {
  if (n <= 0) return null;
  const p = exitos / n;
  const z2 = z * z;
  const denominador = 1 + z2 / n;
  const centro = (p + z2 / (2 * n)) / denominador;
  const medio = (z * Math.sqrt((p * (1 - p)) / n + z2 / (4 * n * n))) / denominador;
  return {
    inferior: Math.max(0, centro - medio),
    superior: Math.min(1, centro + medio),
  };
}

export interface Bin {
  desde: number;
  hasta: number;
  n: number;
}

/** Histograma con bins de ancho fijo entre min y max (valores enteros; último bin cerrado). */
export function histograma(
  valores: readonly number[],
  min: number,
  max: number,
  ancho: number,
): Bin[] {
  const bins: Bin[] = [];
  for (let desde = min; desde <= max; desde += ancho) {
    bins.push({ desde, hasta: Math.min(desde + ancho - 1, max), n: 0 });
  }
  for (const v of valores) {
    if (v < min || v > max) continue;
    const indice = Math.min(Math.floor((v - min) / ancho), bins.length - 1);
    const bin = bins[indice];
    if (bin) bin.n += 1;
  }
  return bins;
}

export function redondear(valor: number | null, decimales = 1): number | null {
  if (valor === null || !Number.isFinite(valor)) return null;
  const factor = 10 ** decimales;
  return Math.round(valor * factor) / factor;
}

export interface Kappa {
  /** Kappa de Cohen. */
  kappa: number;
  /** Acuerdo observado (0–1). */
  po: number;
  /** Acuerdo esperado por azar (0–1). */
  pe: number;
  /** Error estándar aproximado. */
  ee: number;
  /** IC 95 % (z = 1,96), recortado a [-1, 1]. */
  ic95: { inferior: number; superior: number };
}

/**
 * Kappa de Cohen para dos evaluadores y una variable binaria, a partir de la tabla 2×2:
 *
 *                  evaluador B +   evaluador B −
 *   evaluador A +       a               b
 *   evaluador A −       c               d
 *
 * κ = (po − pe) / (1 − pe), con po = (a + d) / n y pe = p(A+)·p(B+) + p(A−)·p(B−).
 * Error estándar: aproximación de Cohen (1960) EE = √(po(1 − po) / (n(1 − pe)²)), suficiente
 * para un IC orientativo con n moderado. Devuelve null si n = 0 o si pe = 1 (los dos evaluadores
 * responden siempre lo mismo y κ no está definido).
 */
export function kappaCohen(a: number, b: number, c: number, d: number, z = 1.96): Kappa | null {
  const n = a + b + c + d;
  if (n <= 0) return null;
  const po = (a + d) / n;
  const pA = (a + b) / n;
  const pB = (a + c) / n;
  const pe = pA * pB + (1 - pA) * (1 - pB);
  if (pe >= 1) return null;
  const kappa = (po - pe) / (1 - pe);
  const ee = Math.sqrt((po * (1 - po)) / (n * (1 - pe) ** 2));
  return {
    kappa,
    po,
    pe,
    ee,
    ic95: {
      inferior: Math.max(-1, kappa - z * ee),
      superior: Math.min(1, kappa + z * ee),
    },
  };
}

/**
 * IC 95 % de una correlación de Pearson con la transformación z de Fisher. Requiere n > 3 y
 * |r| < 1; si no, devuelve null.
 */
export function intervaloPearson(
  r: number,
  n: number,
  z = 1.96,
): { inferior: number; superior: number } | null {
  if (n <= 3 || !Number.isFinite(r) || Math.abs(r) >= 1) return null;
  const zr = Math.atanh(r);
  const ee = 1 / Math.sqrt(n - 3);
  return { inferior: Math.tanh(zr - z * ee), superior: Math.tanh(zr + z * ee) };
}
