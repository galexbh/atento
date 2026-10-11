import { describe, expect, it } from "vitest";
import {
  INSTRUMENTO_ACTUAL,
  listarInstrumentos,
  obtenerInstrumento,
} from "../../src/lib/puntuacion/instrumentos";
import type { Escala } from "../../src/lib/puntuacion/tipos";

function contarPorEscala(id: string): Record<string, number> {
  const conteo: Record<string, number> = {};
  for (const item of obtenerInstrumento(id).items) {
    conteo[item.escala] = (conteo[item.escala] ?? 0) + 1;
  }
  return conteo;
}

describe("registro de instrumentos", () => {
  it("lista ambos instrumentos y el actual es Vanderbilt", () => {
    expect(listarInstrumentos()).toEqual(["vanderbilt-padres-es-1.0", "atento-0.1"]);
    expect(INSTRUMENTO_ACTUAL).toBe("vanderbilt-padres-es-1.0");
    expect(() => obtenerInstrumento("x")).toThrow();
  });
});

describe("vanderbilt-padres-es-1.0", () => {
  const inst = obtenerInstrumento("vanderbilt-padres-es-1.0");

  it("tiene 54 ítems (versión en español, sin 'rendimiento escolar general')", () => {
    expect(inst.items).toHaveLength(54);
  });

  it("ids únicos V01–V54 y orden consecutivo", () => {
    const ids = inst.items.map((i) => i.id);
    expect(new Set(ids).size).toBe(ids.length);
    inst.items.forEach((item, idx) => {
      expect(item.id).toBe(`V${String(idx + 1).padStart(2, "0")}`);
      expect(item.orden).toBe(idx + 1);
    });
  });

  it("conteo por escala correcto", () => {
    expect(contarPorEscala(inst.id)).toEqual({
      inatencion: 9,
      hiperactividad: 9,
      oposicion: 8,
      conducta: 14,
      ansiedad_depresion: 7,
      desempeno: 7,
    } satisfies Record<Escala, number>);
  });

  it("criterios DSM A1a–A1i y A2a–A2i en los ítems 1–18, ninguno después", () => {
    const criterios = inst.items.slice(0, 18).map((i) => i.criterioDSM);
    const esperados = [
      ...["a", "b", "c", "d", "e", "f", "g", "h", "i"].map((l) => `A1${l}`),
      ...["a", "b", "c", "d", "e", "f", "g", "h", "i"].map((l) => `A2${l}`),
    ];
    expect(criterios).toEqual(esperados);
    expect(inst.items.slice(18).every((i) => i.criterioDSM === undefined)).toBe(true);
  });

  it("tipo de ítem coherente con la escala y textos no vacíos", () => {
    for (const item of inst.items) {
      expect(item.texto.trim().length).toBeGreaterThan(0);
      expect(item.fuente).toBe("vanderbilt");
      expect(item.tipo).toBe(item.escala === "desempeno" ? "desempeno" : "frecuencia");
    }
    expect(inst.opcionesFrecuencia.map((o) => o.valor)).toEqual([0, 1, 2, 3]);
    expect(inst.opcionesDesempeno.map((o) => o.valor)).toEqual([1, 2, 3, 4, 5]);
  });
});

describe("atento-0.1", () => {
  const inst = obtenerInstrumento("atento-0.1");

  it("tiene 18 ítems A01–A18 con fuente atento y ejemplo", () => {
    expect(inst.items).toHaveLength(18);
    inst.items.forEach((item, idx) => {
      expect(item.id).toBe(`A${String(idx + 1).padStart(2, "0")}`);
      expect(item.fuente).toBe("atento");
      expect(item.tipo).toBe("frecuencia");
      expect(item.ejemplo?.trim().length ?? 0).toBeGreaterThan(0);
    });
  });

  it("criterios DSM únicos y completos A1a–A2i, 9 inatención y 9 hiperactividad", () => {
    const criterios = inst.items.map((i) => i.criterioDSM);
    expect(new Set(criterios).size).toBe(18);
    const esperados = new Set([
      ...["a", "b", "c", "d", "e", "f", "g", "h", "i"].map((l) => `A1${l}`),
      ...["a", "b", "c", "d", "e", "f", "g", "h", "i"].map((l) => `A2${l}`),
    ]);
    expect(new Set(criterios)).toEqual(esperados);
    expect(contarPorEscala(inst.id)).toEqual({ inatencion: 9, hiperactividad: 9 });
    for (const item of inst.items) {
      expect(item.escala).toBe(
        item.criterioDSM?.startsWith("A1") ? "inatencion" : "hiperactividad",
      );
    }
  });

  it("está marcado como borrador provisional", () => {
    expect(inst.traduccionProvisional).toBe(true);
  });
});
