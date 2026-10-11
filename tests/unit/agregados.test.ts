import { describe, expect, it } from "vitest";
import {
  agregar,
  codigoDepartamentoAgregado,
  esCodigoDepartamento,
  type FilaRespuesta,
  intervaloWilson,
  periodosDeFecha,
  UMBRAL_SUPRESION,
  VERSION_TODAS,
} from "../../src/lib/agregados/calcular";
import { literalSql, sqlInsertarAgregados, trocear } from "../../src/lib/agregados/sql";

function fila(parcial: Partial<FilaRespuesta> = {}): FilaRespuesta {
  return {
    creado_en: "2026-10-05",
    departamento: "08",
    municipio: "0801",
    pos_inatencion: 0,
    pos_hiperactividad: 0,
    version_instrumento: "vanderbilt-padres-es-1.0",
    ...parcial,
  };
}

describe("intervaloWilson", () => {
  it("coincide con valores de referencia", () => {
    // 3/10: Wilson 95 % ≈ [0.1078, 0.6032]
    const [a, b] = intervaloWilson(3, 10);
    expect(a).toBeCloseTo(0.1078, 3);
    expect(b).toBeCloseTo(0.6032, 3);
    // 0/20 no baja de 0 y tiene límite superior > 0 (a diferencia del método clásico).
    const [c, d] = intervaloWilson(0, 20);
    expect(c).toBe(0);
    expect(d).toBeCloseTo(0.1611, 3);
    // 20/20 no supera 1.
    const [e, f] = intervaloWilson(20, 20);
    expect(f).toBe(1);
    expect(e).toBeCloseTo(0.8389, 3);
  });

  it("n = 0 devuelve [0, 0]", () => {
    expect(intervaloWilson(0, 0)).toEqual([0, 0]);
  });

  it("es más estrecho cuanto mayor es n", () => {
    const [a1, b1] = intervaloWilson(5, 10);
    const [a2, b2] = intervaloWilson(500, 1000);
    expect(b2 - a2).toBeLessThan(b1 - a1);
  });
});

describe("periodosDeFecha", () => {
  it("devuelve acumulado, año, trimestre y mes", () => {
    expect(periodosDeFecha("2026-10-05")).toEqual(["acumulado", "2026", "2026-Q4", "2026-10"]);
    expect(periodosDeFecha("2026-01-31")).toEqual(["acumulado", "2026", "2026-Q1", "2026-01"]);
    expect(periodosDeFecha("2025-06-15")).toEqual(["acumulado", "2025", "2025-Q2", "2025-06"]);
    expect(periodosDeFecha("2025-09-01")).toEqual(["acumulado", "2025", "2025-Q3", "2025-09"]);
  });

  it("rechaza fechas inválidas", () => {
    expect(() => periodosDeFecha("2026-13-01")).toThrow();
    expect(() => periodosDeFecha("hoy")).toThrow();
  });
});

describe("códigos de departamento", () => {
  it("usa depto + '00'", () => {
    expect(codigoDepartamentoAgregado("08")).toBe("0800");
    expect(esCodigoDepartamento("0800")).toBe(true);
    expect(esCodigoDepartamento("0801")).toBe(false);
  });
});

describe("agregar", () => {
  it("suprime n < 5 conservando n", () => {
    const filas = Array.from({ length: UMBRAL_SUPRESION - 1 }, () => fila({ pos_inatencion: 1 }));
    const [acumulado] = agregar(filas).filter(
      (a) =>
        a.periodo === "acumulado" &&
        a.municipio === "0801" &&
        a.version_instrumento === VERSION_TODAS,
    );
    expect(acumulado).toMatchObject({
      n: 4,
      suprimido: 1,
      pct_inatencion: null,
      pct_hiperactividad: null,
      pct_combinado: null,
      pct_ambas: null,
      ic95_inf: null,
      ic95_sup: null,
    });
  });

  it("calcula porcentajes y Wilson con n >= 5", () => {
    const filas = [
      fila({ pos_inatencion: 1, pos_hiperactividad: 1 }),
      fila({ pos_inatencion: 1 }),
      fila({ pos_hiperactividad: 1 }),
      fila(),
      fila(),
    ];
    const a = agregar(filas).find(
      (x) =>
        x.periodo === "2026" && x.municipio === "0801" && x.version_instrumento === VERSION_TODAS,
    );
    expect(a).toMatchObject({
      n: 5,
      suprimido: 0,
      pct_inatencion: 40,
      pct_hiperactividad: 40,
      pct_combinado: 60,
      pct_ambas: 20,
    });
    const [inf, sup] = intervaloWilson(3, 5);
    expect(a?.ic95_inf).toBeCloseTo(inf * 100, 1);
    expect(a?.ic95_sup).toBeCloseTo(sup * 100, 1);
  });

  it("agrupa por departamento sumando municipios y por versión + 'todas'", () => {
    const filas = [
      ...Array.from({ length: 3 }, () => fila({ municipio: "0801", pos_inatencion: 1 })),
      ...Array.from({ length: 3 }, () =>
        fila({ municipio: "0802", version_instrumento: "atento-0.1" }),
      ),
      fila({ departamento: "05", municipio: "0501" }),
    ];
    const todo = agregar(filas);
    const depto = todo.find(
      (x) =>
        x.periodo === "acumulado" &&
        x.municipio === "0800" &&
        x.version_instrumento === VERSION_TODAS,
    );
    expect(depto).toMatchObject({ departamento: "08", n: 6, pct_inatencion: 50, suprimido: 0 });
    const deptoVanderbilt = todo.find(
      (x) =>
        x.periodo === "acumulado" &&
        x.municipio === "0800" &&
        x.version_instrumento === "vanderbilt-padres-es-1.0",
    );
    expect(deptoVanderbilt?.n).toBe(3);
    const deptoAtento = todo.find(
      (x) =>
        x.periodo === "acumulado" &&
        x.municipio === "0800" &&
        x.version_instrumento === "atento-0.1",
    );
    expect(deptoAtento?.n).toBe(3);
    const cortes = todo.find((x) => x.periodo === "acumulado" && x.municipio === "0500");
    expect(cortes).toMatchObject({ departamento: "05", n: 1, suprimido: 1 });
    // Sin filas para combinaciones vacías.
    expect(todo.some((x) => x.municipio === "0803")).toBe(false);
    // Todas las claves (periodo, municipio, versión) son únicas.
    const claves = new Set(todo.map((x) => `${x.periodo}|${x.municipio}|${x.version_instrumento}`));
    expect(claves.size).toBe(todo.length);
  });

  it("genera los cuatro periodos por fila", () => {
    const periodos = new Set(agregar([fila({ creado_en: "2025-03-09" })]).map((x) => x.periodo));
    expect([...periodos].sort()).toEqual(["2025", "2025-03", "2025-Q1", "acumulado"]);
  });

  it("con lista vacía devuelve []", () => {
    expect(agregar([])).toEqual([]);
  });
});

describe("sql", () => {
  it("genera INSERT multi-fila y trocea", () => {
    expect(sqlInsertarAgregados(2)).toMatch(/VALUES \(\?(, \?){12}\), \(\?(, \?){12}\)$/);
    expect(trocear([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
    expect(literalSql(null)).toBe("NULL");
    expect(literalSql(3.5)).toBe("3.5");
    expect(literalSql("it's")).toBe("'it''s'");
  });
});
