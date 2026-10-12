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
    expect(r.escalas.inatencion.completa).toBe(true);
  });

  it("conducta (14 ítems): 1 faltante se tolera, 2 la dejan incompleta y sin alerta", () => {
    const resp = marcar(base(), "conducta", 3, 3);
    const ids = instrumento.items.filter((i) => i.escala === "conducta").map((i) => i.id);
    delete resp[ids[13] as string];
    let r = puntuar({ instrumentoId: ID, respuestas: resp });
    expect(r.escalas.conducta.positivo).toBe(true);
    expect(r.alertas).toContain("conducta");
    delete resp[ids[12] as string];
    r = puntuar({ instrumentoId: ID, respuestas: resp });
    expect(r.escalas.conducta.completa).toBe(false);
    expect(r.escalas.conducta.positivo).toBe(false);
    expect(r.alertas).not.toContain("conducta");
  });

  it("desempeño: incompleto solo si falta la mitad o más", () => {
    const ids = instrumento.items.filter((i) => i.escala === "desempeno").map((i) => i.id);
    const resp = base();
    resp[ids[0] as string] = 5;
    for (const id of ids.slice(1, 4)) delete resp[id];
    let r = puntuar({ instrumentoId: ID, respuestas: resp });
    expect(r.escalas.desempeno.total - r.escalas.desempeno.respondidos).toBe(3);
    expect(r.escalas.desempeno.completa).toBe(ids.length > 6);
    delete resp[ids[4] as string];
    r = puntuar({ instrumentoId: ID, respuestas: resp });
    expect(r.escalas.desempeno.completa).toBe(false);
    expect(r.escalas.desempeno.positivo).toBe(false);
  });

  it("sin nivel entregable si inatención e hiperactividad están incompletas", () => {
    const resp = base();
    for (const escala of ["inatencion", "hiperactividad"] as const) {
      const ids = instrumento.items.filter((i) => i.escala === escala).map((i) => i.id);
      delete resp[ids[0] as string];
      delete resp[ids[1] as string];
    }
    const r = puntuar({ instrumentoId: ID, respuestas: resp });
    expect(r.nivelEntregable).toBe(false);
    expect(r.escalasIncompletas).toEqual(expect.arrayContaining(["inatencion", "hiperactividad"]));
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
  it("1 faltante en una escala de síntomas se tolera (cuenta como 0)", () => {
    const resp = marcar(base(), "inatencion", 9, 3);
    delete resp.V09;
    const r = puntuar({ instrumentoId: ID, respuestas: resp });
    expect(r.itemsFaltantes).toEqual(["V09"]);
    expect(r.escalas.inatencion.respondidos).toBe(8);
    expect(r.escalas.inatencion.total).toBe(9);
    expect(r.escalas.inatencion.positivo).toBe(true);
  });

  it("2 faltantes dejan la escala incompleta: no es positiva aunque alcance el umbral", () => {
    const resp = marcar(base(), "inatencion", 9, 3);
    delete resp.V08;
    delete resp.V09;
    const r = puntuar({ instrumentoId: ID, respuestas: resp });
    expect(r.itemsFaltantes).toEqual(["V08", "V09"]);
    expect(r.escalas.inatencion.respondidos).toBe(7);
    expect(r.escalas.inatencion.positivosCriterio).toBe(7);
    expect(r.escalas.inatencion.positivo).toBe(false);
    expect(r.escalas.inatencion.completa).toBe(false);
    expect(r.escalasIncompletas).toContain("inatencion");
    expect(r.nivelEntregable).toBe(true);
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

describe("puntuar – vanderbilt-docente-es-1.0 (reglas de la fuente)", () => {
  const DOC = "vanderbilt-docente-es-1.0";
  const docente = obtenerInstrumento(DOC);
  const baseDocente = (): Record<string, number> => {
    const r: Record<string, number> = {};
    for (const item of docente.items) r[item.id] = item.tipo === "desempeno" ? 1 : 0;
    return r;
  };
  const marcarDocente = (r: Record<string, number>, escala: Escala, n: number, valor: number) => {
    for (const item of docente.items.filter((i) => i.escala === escala).slice(0, n)) {
      r[item.id] = valor;
    }
    return r;
  };
  const p = (respuestas: Record<string, number>) => puntuar({ instrumentoId: DOC, respuestas });

  it("todo 0 y desempeño 1: nada positivo, nivel bajo, oposición sin ítems (total 0)", () => {
    const r = p(baseDocente());
    expect(r.nivel).toBe("bajo");
    expect(r.itemsFaltantes).toEqual([]);
    expect(r.escalas.oposicion).toMatchObject({ total: 0, positivo: false });
    expect(r.escalas.conducta.total).toBe(10);
    expect(r.escalas.desempeno.total).toBe(8);
  });

  it("inatención: 5 con 2–3 no es positiva; 6 sí (ítems 1–9)", () => {
    expect(p(marcarDocente(baseDocente(), "inatencion", 5, 3)).escalas.inatencion.positivo).toBe(
      false,
    );
    expect(p(marcarDocente(baseDocente(), "inatencion", 6, 2)).escalas.inatencion.positivo).toBe(
      true,
    );
  });

  it("hiperactividad: umbral 6 de 9 (ítems 10–18)", () => {
    const cinco = p(marcarDocente(baseDocente(), "hiperactividad", 5, 2));
    const seis = p(marcarDocente(baseDocente(), "hiperactividad", 6, 2));
    expect(cinco.escalas.hiperactividad.positivo).toBe(false);
    expect(seis.escalas.hiperactividad.positivo).toBe(true);
  });

  it("oposición/conducta combinada (19–28): 2 no, 3 sí; alerta de conducta, nunca de oposición", () => {
    expect(p(marcarDocente(baseDocente(), "conducta", 2, 3)).escalas.conducta.positivo).toBe(false);
    const tres = p(marcarDocente(baseDocente(), "conducta", 3, 2));
    expect(tres.escalas.conducta).toMatchObject({
      positivo: true,
      umbral: 3,
      positivosCriterio: 3,
    });
    expect(tres.alertas).toEqual(["conducta"]);
    const todo = p(marcarDocente(baseDocente(), "conducta", 10, 3));
    expect(todo.escalas.oposicion.positivo).toBe(false);
    expect(todo.alertas).not.toContain("oposicion");
  });

  it("ansiedad/depresión (29–35): 2 no, 3 sí", () => {
    const dos = p(marcarDocente(baseDocente(), "ansiedad_depresion", 2, 2));
    const tres = p(marcarDocente(baseDocente(), "ansiedad_depresion", 3, 2));
    expect(dos.escalas.ansiedad_depresion.positivo).toBe(false);
    expect(tres.escalas.ansiedad_depresion.positivo).toBe(true);
  });

  it("desempeño (36–43): basta 1 ítem con 4 o 5; con 3 no", () => {
    expect(p(marcarDocente(baseDocente(), "desempeno", 8, 3)).escalas.desempeno.positivo).toBe(
      false,
    );
    const r4 = baseDocente();
    r4.T43 = 4;
    expect(p(r4).escalas.desempeno.positivo).toBe(true);
  });

  it("nivel: alto con inatención + desempeño; moderado sin desempeño", () => {
    const alto = marcarDocente(baseDocente(), "inatencion", 6, 3);
    alto.T36 = 5;
    expect(p(alto).nivel).toBe("alto");
    expect(p(marcarDocente(baseDocente(), "hiperactividad", 9, 3)).nivel).toBe("moderado");
  });

  it("docente: 1 faltante en oposición/conducta se tolera; 2 anulan la positividad", () => {
    const r = marcarDocente(baseDocente(), "conducta", 3, 3);
    delete r.T28;
    expect(p(r).escalas.conducta.positivo).toBe(true);
    delete r.T27;
    expect(p(r).escalas.conducta.positivo).toBe(false);
  });

  it("rechaza ítems de padres y valores fuera de rango", () => {
    expect(() => p({ V01: 1 })).toThrow(/no pertenece/);
    expect(() => p({ T36: 0 })).toThrow(/fuera de rango/);
    expect(() => p({ T01: 4 })).toThrow(/fuera de rango/);
  });

  it("las reglas de padres no cambian", () => {
    const padres = puntuar({ instrumentoId: ID, respuestas: base() });
    expect(padres.escalas.oposicion).toMatchObject({ umbral: 4, total: 8 });
    expect(padres.escalas.conducta).toMatchObject({ umbral: 3, total: 14 });
  });
});
