import { describe, expect, it } from "vitest";
import {
  alfaCronbach,
  alfaSinItem,
  correlacionItemTotalCorregida,
  descriptivos,
  desviacion,
  histograma,
  media,
  mediana,
  pearson,
  percentil,
  redondear,
  wilson,
} from "@/lib/reportes/estadistica";

describe("estadística descriptiva", () => {
  const unoADiez = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

  it("media, mediana y desviación muestral", () => {
    expect(media(unoADiez)).toBe(5.5);
    expect(mediana(unoADiez)).toBe(5.5);
    expect(mediana([3, 1, 2])).toBe(2);
    expect(desviacion([2, 4, 4, 4, 5, 5, 7, 9])).toBeCloseTo(2.138, 3);
    expect(media([])).toBeNull();
    expect(desviacion([1])).toBeNull();
  });

  it("percentiles con interpolación tipo 7 (R/NumPy)", () => {
    expect(percentil(unoADiez, 25)).toBeCloseTo(3.25, 6);
    expect(percentil(unoADiez, 50)).toBeCloseTo(5.5, 6);
    expect(percentil(unoADiez, 90)).toBeCloseTo(9.1, 6);
    expect(percentil(unoADiez, 0)).toBe(1);
    expect(percentil(unoADiez, 100)).toBe(10);
    expect(percentil([], 50)).toBeNull();
  });

  it("descriptivos completos", () => {
    const d = descriptivos(unoADiez);
    expect(d.n).toBe(10);
    expect(d.min).toBe(1);
    expect(d.max).toBe(10);
    expect(d.p10).toBeCloseTo(1.9, 6);
    expect(d.p75).toBeCloseTo(7.75, 6);
  });

  it("histograma con bins de ancho fijo", () => {
    const bins = histograma([0, 1, 2, 3, 5, 8, 8, 9], 0, 9, 3);
    expect(bins).toEqual([
      { desde: 0, hasta: 2, n: 3 },
      { desde: 3, hasta: 5, n: 2 },
      { desde: 6, hasta: 8, n: 2 },
      { desde: 9, hasta: 9, n: 1 },
    ]);
  });

  it("redondear", () => {
    expect(redondear(1.2345, 2)).toBe(1.23);
    expect(redondear(null)).toBeNull();
    expect(redondear(Number.NaN)).toBeNull();
  });
});

describe("correlación y fiabilidad", () => {
  it("pearson con valores conocidos", () => {
    expect(pearson([1, 2, 3], [2, 4, 6])).toBeCloseTo(1, 9);
    expect(pearson([1, 2, 3], [3, 2, 1])).toBeCloseTo(-1, 9);
    expect(pearson([1, 2, 3, 4, 5], [2, 4, 5, 4, 5])).toBeCloseTo(0.7746, 4);
    expect(pearson([1, 1, 1], [1, 2, 3])).toBeNull();
    expect(pearson([1], [2])).toBeNull();
  });

  // 5 sujetos x 3 ítems: var ítems = 1.3 + 1.0 + 0.7 = 3.0; var total = 7.3.
  const matriz = [
    [2, 3, 2],
    [1, 1, 1],
    [3, 3, 2],
    [0, 1, 1],
    [2, 2, 3],
  ];

  it("alfa de Cronbach con valores calculados a mano", () => {
    expect(alfaCronbach(matriz)).toBeCloseTo(1.5 * (1 - 3.0 / 7.3), 6);
  });

  it("alfa = 1 con ítems perfectamente paralelos", () => {
    expect(
      alfaCronbach([
        [1, 2, 1],
        [2, 3, 2],
        [3, 4, 3],
        [4, 5, 4],
      ]),
    ).toBeCloseTo(1, 9);
  });

  it("alfa no definida con menos de 2 ítems o sujetos", () => {
    expect(alfaCronbach([[1], [2]])).toBeNull();
    expect(alfaCronbach([[1, 2]])).toBeNull();
    expect(
      alfaCronbach([
        [1, 1],
        [1, 1],
      ]),
    ).toBeNull();
  });

  it("correlación ítem-total corregida y alfa sin el ítem", () => {
    // Ítem 0 vs suma de ítems 1 y 2: [5,2,5,2,5] frente a [2,1,3,0,2].
    expect(correlacionItemTotalCorregida(matriz, 0)).toBeCloseTo(
      pearson([2, 1, 3, 0, 2], [5, 2, 5, 2, 5]) as number,
      9,
    );
    expect(alfaSinItem(matriz, 2)).toBeCloseTo(
      alfaCronbach([
        [2, 3],
        [1, 1],
        [3, 3],
        [0, 1],
        [2, 2],
      ]) as number,
      9,
    );
  });
});

describe("intervalo de Wilson", () => {
  it("0 de 10 y 5 de 10 (valores de referencia)", () => {
    const cero = wilson(0, 10) as { inferior: number; superior: number };
    expect(cero.inferior).toBe(0);
    expect(cero.superior).toBeCloseTo(0.2775, 3);
    const mitad = wilson(5, 10) as { inferior: number; superior: number };
    expect(mitad.inferior).toBeCloseTo(0.2366, 3);
    expect(mitad.superior).toBeCloseTo(0.7634, 3);
  });

  it("n = 0 no está definido", () => {
    expect(wilson(0, 0)).toBeNull();
  });
});
