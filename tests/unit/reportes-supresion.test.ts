import { describe, expect, it } from "vitest";
import { aCsv, aplanar, generarCodebook } from "@/lib/reportes/exportar";
import { construirWhere, parsearFiltros, rangoPeriodo } from "@/lib/reportes/filtros";
import {
  compararFilas,
  conteo,
  diferencia,
  proporcion,
  UMBRAL_SUPRESION,
} from "@/lib/reportes/supresion";

describe("supresión de celdas pequeñas", () => {
  it("umbral de 5", () => {
    expect(UMBRAL_SUPRESION).toBe(5);
    expect(conteo(4)).toEqual({ n: 0, suprimido: true });
    expect(conteo(5)).toEqual({ n: 5, suprimido: false });
  });

  it("proporción suprimida con n < 5 y con IC95 Wilson si no", () => {
    expect(proporcion(2, 4)).toEqual({ n: 0, suprimido: true, pct: null, ic95: null });
    const p = proporcion(3, 10);
    expect(p.n).toBe(10);
    expect(p.pct).toBe(30);
    expect(p.ic95?.inferior).toBeCloseTo(10.8, 0);
    expect(p.ic95?.superior).toBeCloseTo(60.3, 0);
  });

  it("diferencia absoluta y relativa", () => {
    expect(diferencia(10, 15)).toEqual({ a: 10, b: 15, absoluta: 5, relativa: 50 });
    expect(diferencia(0, 5).relativa).toBeNull();
    expect(diferencia(null, 5).absoluta).toBeNull();
  });

  it("comparación de filas por clave con celdas suprimidas", () => {
    const a = [
      { codigo: "08", positivo: proporcion(10, 100), n: conteo(100) },
      { codigo: "05", positivo: proporcion(1, 3), n: conteo(3) },
    ];
    const b = [
      { codigo: "08", positivo: proporcion(15, 100), n: conteo(100) },
      { codigo: "05", positivo: proporcion(2, 10), n: conteo(10) },
    ];
    const c = compararFilas(a, b, "codigo", ["positivo", "n"]);
    expect(c[1]?.clave).toBe("08");
    expect(c[1]?.diferencias.positivo?.absoluta).toBe(5);
    expect(c[1]?.diferencias.positivo?.relativa).toBe(50);
    expect(c[0]?.diferencias.positivo?.absoluta).toBeNull();
    expect(c[0]?.diferencias.n?.b).toBe(10);
  });
});

describe("filtros y periodos", () => {
  it("rango de periodos", () => {
    expect(rangoPeriodo("2026")).toEqual({ desde: "2026-01-01", hasta: "2027-01-01" });
    expect(rangoPeriodo("2026-Q4")).toEqual({ desde: "2026-10-01", hasta: "2027-01-01" });
    expect(rangoPeriodo("2026-Q1")).toEqual({ desde: "2026-01-01", hasta: "2026-04-01" });
    expect(rangoPeriodo("2026-12")).toEqual({ desde: "2026-12-01", hasta: "2027-01-01" });
    expect(rangoPeriodo("acumulado")).toBeNull();
  });

  it("parsea la query ignorando valores inválidos", () => {
    const f = parsearFiltros(
      new URLSearchParams(
        "periodo=2026-Q2&departamento=08&municipio=0801&edadMin=7&edadMax=99&sexo=Z&informante=madre&soloConsentimiento=1&comparar=2025",
      ),
    );
    expect(f.periodo).toBe("2026-Q2");
    expect(f.departamento).toBe("08");
    expect(f.municipio).toBe("0801");
    expect(f.edadMin).toBe(7);
    expect(f.edadMax).toBeUndefined();
    expect(f.sexo).toBeUndefined();
    expect(f.informante).toBe("madre");
    expect(f.soloConsentimiento).toBe(true);
    expect(f.comparar).toBe("2025");
    expect(parsearFiltros(new URLSearchParams("periodo=x")).periodo).toMatch(/^\d{4}$/);
  });

  it("construye el WHERE parametrizado", () => {
    const f = parsearFiltros(new URLSearchParams("periodo=2026&departamento=08&sexo=F"));
    const w = construirWhere(f);
    expect(w.sql).toBe(
      "completado = 1 AND creado_en >= ? AND creado_en < ? AND departamento = ? AND sexo = ?",
    );
    expect(w.params).toEqual(["2026-01-01", "2027-01-01", "08", "F"]);
    expect(construirWhere(f, { incluirIncompletas: true, ignorarPeriodo: true }).sql).toBe(
      "departamento = ? AND sexo = ?",
    );
  });
});

describe("exportación", () => {
  it("aplana objetos anidados", () => {
    expect(aplanar({ a: 1, b: { c: null, d: "x" }, e: [1, 2] })).toEqual({
      a: 1,
      b_c: null,
      b_d: "x",
      e_0: 1,
      e_1: 2,
    });
  });

  it("CSV con BOM, coma y escape de comillas", () => {
    const csv = aCsv([
      { a: 1, b: 'di "hola", ya' },
      { a: null, b: "x" },
    ]);
    expect(csv.startsWith("﻿a,b\r\n")).toBe(true);
    expect(csv).toContain('1,"di ""hola"", ya"\r\n');
    expect(csv).toContain(",x\r\n");
  });

  it("codebook incluye variables e ítems de ambos instrumentos", () => {
    const md = generarCodebook();
    expect(md).toContain("| V01 |");
    expect(md).toContain("| A18 |");
    expect(md).toContain("municipio_recodificado");
    expect(md).toContain("vanderbilt-padres-es-1.0");
  });
});
