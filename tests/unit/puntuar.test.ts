import { describe, expect, it } from "vitest";
import { obtenerInstrumento } from "../../src/lib/puntuacion/instrumentos";
import { puntuar } from "../../src/lib/puntuacion/puntuar";
import type { Escala } from "../../src/lib/puntuacion/tipos";

const ID = "vanderbilt-padres-es-1.0";
const instrumento = obtenerInstrumento(ID);

/** Respuestas base: todo 0 en frecuencia y 1 en desempeño. */
function base(): Record<string, number> {
  const r: Record<string, number> = {};
  for (const item of instrumento.items) {
    r[item.id] = item.tipo === "desempeno" ? 1 : 0;
  }
  return r;
}

function idsDe(escala: Escala): string[] {
  return instrumento.items.filter((i) => i.escala === escala).map((i) => i.id);
}

/** Pone `valor` en los primeros `n` ítems de la escala. */
function marcar(
  r: Record<string, number>,
  escala: Escala,
  n: number,
  valor: number,
): Record<string, number> {
  for (const id of idsDe(escala).slice(0, n)) r[id] = valor;
  return r;
}

describe("puntuar – umbrales Vanderbilt", () => {
  it("5 ítems con 2–3 en inatención no es positivo; 6 sí", () => {
    const cinco = puntuar({ instrumentoId: ID, respuestas: marcar(base(), "inatencion", 5, 2) });
    expect(cinco.escalas.inatencion.positivosCriterio).toBe(5);
    expect(cinco.escalas.inatencion.positivo).toBe(false);

    const seis = puntuar({ instrumentoId: ID, respuestas: marcar(base(), "inatencion", 6, 3) });
    expect(seis.escalas.inatencion.positivosCriterio).toBe(6);
    expect(seis.escalas.inatencion.positivo).toBe(true);
  });

  it("el valor 1 no cuenta como criterio aunque sume puntaje", () => {
    const r = puntuar({ instrumentoId: ID, respuestas: marcar(base(), "inatencion", 9, 1) });
    expect(r.escalas.inatencion.puntaje).toBe(9);
    expect(r.escalas.inatencion.positivosCriterio).toBe(0);
    expect(r.escalas.inatencion.positivo).toBe(false);
  });

  it("desempeño positivo con un solo ítem en 4 y sin síntomas → nivel bajo", () => {
    const resp = base();
    resp.V48 = 4;
    const r = puntuar({ instrumentoId: ID, respuestas: resp });
    expect(r.escalas.desempeno.positivo).toBe(true);
    expect(r.nivel).toBe("bajo");
    expect(r.alertas).toEqual([]);
  });

  it("todos 0 (y desempeño 1): nada positivo, nivel bajo, sin faltantes", () => {
    const r = puntuar({ instrumentoId: ID, respuestas: base() });
    for (const e of Object.values(r.escalas)) {
      expect(e.positivo).toBe(false);
      expect(e.respondidos).toBe(e.total);
    }
    expect(r.itemsFaltantes).toEqual([]);
    expect(r.nivel).toBe("bajo");
    expect(r.combinado).toBe(false);
  });

  it("todos 3 (y desempeño 5): todo positivo, combinado, alto, tres alertas", () => {
    const resp: Record<string, number> = {};
    for (const item of instrumento.items) resp[item.id] = item.tipo === "desempeno" ? 5 : 3;
    const r = puntuar({ instrumentoId: ID, respuestas: resp });
    for (const e of Object.values(r.escalas)) expect(e.positivo).toBe(true);
    expect(r.escalas.inatencion.puntaje).toBe(27);
    expect(r.escalas.conducta.total).toBe(14);
    expect(r.combinado).toBe(true);
    expect(r.nivel).toBe("alto");
    expect(r.alertas).toEqual(["oposicion", "conducta", "ansiedad_depresion"]);
  });

  it("umbrales por escala: oposición 4, conducta 3, ansiedad/depresión 3", () => {
    const r = puntuar({ instrumentoId: ID, respuestas: base() });
    expect(r.escalas.oposicion.umbral).toBe(4);
    expect(r.escalas.conducta.umbral).toBe(3);
    expect(r.escalas.ansiedad_depresion.umbral).toBe(3);
    expect(r.escalas.desempeno.umbral).toBe(1);

    const resp = marcar(marcar(base(), "oposicion", 3, 3), "conducta", 2, 3);
    const r2 = puntuar({ instrumentoId: ID, respuestas: resp });
    expect(r2.alertas).toEqual([]);
    const r3 = puntuar({
      instrumentoId: ID,
      respuestas: marcar(marcar(base(), "oposicion", 4, 2), "ansiedad_depresion", 3, 2),
    });
    expect(r3.alertas).toEqual(["oposicion", "ansiedad_depresion"]);
  });
});

describe("puntuar – nivel (regla Atento)", () => {
  it("alto: inatención positiva + desempeño positivo", () => {
    const resp = marcar(base(), "inatencion", 6, 2);
    resp.V51 = 5;
    expect(puntuar({ instrumentoId: ID, respuestas: resp }).nivel).toBe("alto");
  });

  it("moderado: hiperactividad positiva sin desempeño positivo", () => {
    const resp = marcar(base(), "hiperactividad", 7, 3);
    const r = puntuar({ instrumentoId: ID, respuestas: resp });
    expect(r.nivel).toBe("moderado");
    expect(r.combinado).toBe(false);
  });

  it("moderado: 4 ítems con 2–3 en inatención + desempeño positivo", () => {
    const resp = marcar(base(), "inatencion", 4, 2);
    resp.V50 = 4;
    expect(puntuar({ instrumentoId: ID, respuestas: resp }).nivel).toBe("moderado");
  });

  it("bajo: 3 ítems con 2–3 en inatención + desempeño positivo", () => {
    const resp = marcar(base(), "inatencion", 3, 3);
    resp.V50 = 4;
    expect(puntuar({ instrumentoId: ID, respuestas: resp }).nivel).toBe("bajo");
  });

  it("bajo: 5 ítems con 2–3 sin desempeño positivo", () => {
    const resp = marcar(base(), "hiperactividad", 5, 3);
    expect(puntuar({ instrumentoId: ID, respuestas: resp }).nivel).toBe("bajo");
  });

  it("combinado requiere ambas escalas nucleares positivas", () => {
    const resp = marcar(marcar(base(), "inatencion", 6, 2), "hiperactividad", 6, 2);
    const r = puntuar({ instrumentoId: ID, respuestas: resp });
    expect(r.combinado).toBe(true);
    expect(r.nivel).toBe("moderado");
  });
});

describe("puntuar – faltantes y errores", () => {
  it("faltantes ≤20 % no invalidan la escala", () => {
    const resp = marcar(base(), "inatencion", 9, 3);
    delete resp.V09; // 1 de 9 ≈ 11 %
    const r = puntuar({ instrumentoId: ID, respuestas: resp });
    expect(r.itemsFaltantes).toEqual(["V09"]);
    expect(r.escalas.inatencion.respondidos).toBe(8);
    expect(r.escalas.inatencion.total).toBe(9);
    expect(r.escalas.inatencion.positivo).toBe(true);
  });

  it("faltantes >20 % marcan positivo=false aunque se alcance el umbral", () => {
    const resp = marcar(base(), "inatencion", 9, 3);
    delete resp.V08;
    delete resp.V09; // 2 de 9 ≈ 22 %
    const r = puntuar({ instrumentoId: ID, respuestas: resp });
    expect(r.itemsFaltantes).toEqual(["V08", "V09"]);
    expect(r.escalas.inatencion.respondidos).toBe(7);
    expect(r.escalas.inatencion.positivosCriterio).toBe(7);
    expect(r.escalas.inatencion.positivo).toBe(false);
  });

  it("sin respuestas: lista todos los ítems como faltantes y no falla", () => {
    const r = puntuar({ instrumentoId: ID, respuestas: {} });
    expect(r.itemsFaltantes).toHaveLength(instrumento.items.length);
    expect(r.nivel).toBe("bajo");
  });

  it("valores fuera de rango lanzan error claro", () => {
    const alto = base();
    alto.V01 = 4;
    expect(() => puntuar({ instrumentoId: ID, respuestas: alto })).toThrow(/fuera de rango.*V01/);
    const bajo = base();
    bajo.V48 = 0;
    expect(() => puntuar({ instrumentoId: ID, respuestas: bajo })).toThrow(/fuera de rango.*V48/);
    const decimal = base();
    decimal.V02 = 1.5;
    expect(() => puntuar({ instrumentoId: ID, respuestas: decimal })).toThrow(/entero/);
  });

  it("ítem desconocido o instrumento desconocido lanzan", () => {
    const resp = base();
    resp.ZZZ = 1;
    expect(() => puntuar({ instrumentoId: ID, respuestas: resp })).toThrow(/ZZZ/);
    expect(() => puntuar({ instrumentoId: "nada", respuestas: {} })).toThrow(/desconocido/);
  });
});

describe("puntuar – atento-0.1 (reglas provisionales)", () => {
  it("puntúa con los mismos umbrales y escalas sin ítems quedan en total 0", () => {
    const resp: Record<string, number> = {};
    for (let i = 1; i <= 18; i++) resp[`A${String(i).padStart(2, "0")}`] = i <= 6 ? 3 : 0;
    const r = puntuar({ instrumentoId: "atento-0.1", respuestas: resp });
    expect(r.escalas.inatencion.positivo).toBe(true);
    expect(r.escalas.oposicion.total).toBe(0);
    expect(r.escalas.oposicion.positivo).toBe(false);
    expect(r.escalas.desempeno.total).toBe(0);
    expect(r.nivel).toBe("moderado");
  });
});
