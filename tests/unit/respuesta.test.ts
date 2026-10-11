import { describe, expect, it } from "vitest";
import { obtenerInstrumento } from "../../src/lib/puntuacion/instrumentos";
import { type Envio, EsquemaEnvio } from "../../src/lib/validacion/respuesta";

const instrumento = obtenerInstrumento("vanderbilt-padres-es-1.0");

function respuestasCompletas(): Record<string, number> {
  const r: Record<string, number> = {};
  for (const item of instrumento.items) r[item.id] = item.tipo === "desempeno" ? 3 : 1;
  return r;
}

function envioValido(): Envio {
  return {
    id: "3f2b6c1e-8d4a-4c2b-9e1f-6a7b8c9d0e1f",
    instrumentoId: "vanderbilt-padres-es-1.0",
    respuestas: respuestasCompletas(),
    departamento: "08",
    municipio: "0801",
    edadAnios: 8,
    sexo: "F",
    informante: "madre",
    consentimientoInvestigacion: true,
    versionConsentimiento: "v1",
    duracionSegundos: 420,
    completado: true,
    turnstileToken: "token-de-prueba",
    hp: "",
  };
}

describe("EsquemaEnvio", () => {
  it("acepta un envío válido completo", () => {
    const r = EsquemaEnvio.safeParse(envioValido());
    expect(r.success).toBe(true);
  });

  it("acepta campos opcionales válidos", () => {
    const e = {
      ...envioValido(),
      codigoVinculo: "AB12cd34",
      itemAbandono: "V10",
      completado: false,
    };
    expect(EsquemaEnvio.safeParse(e).success).toBe(true);
  });

  it("rechaza municipio de otro departamento", () => {
    const e = { ...envioValido(), municipio: "0101" };
    const r = EsquemaEnvio.safeParse(e);
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues.some((i) => i.path.includes("municipio"))).toBe(true);
  });

  it("rechaza departamento fuera del catálogo", () => {
    const e = { ...envioValido(), departamento: "19", municipio: "1901" };
    expect(EsquemaEnvio.safeParse(e).success).toBe(false);
  });

  it("rechaza ítem desconocido", () => {
    const e = envioValido();
    e.respuestas.X99 = 1;
    const r = EsquemaEnvio.safeParse(e);
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues.some((i) => i.path.includes("X99"))).toBe(true);
  });

  it("rechaza valores fuera de rango según el tipo de ítem", () => {
    const a = envioValido();
    a.respuestas.V01 = 4;
    expect(EsquemaEnvio.safeParse(a).success).toBe(false);
    const b = envioValido();
    b.respuestas.V48 = 0;
    expect(EsquemaEnvio.safeParse(b).success).toBe(false);
    const c = envioValido();
    c.respuestas.V02 = 1.5;
    expect(EsquemaEnvio.safeParse(c).success).toBe(false);
  });

  it("rechaza campo extra (strict)", () => {
    const e = { ...envioValido(), extra: "no" };
    expect(EsquemaEnvio.safeParse(e).success).toBe(false);
  });

  it("rechaza honeypot con contenido, uuid que no es v4, edad fuera de 6–12", () => {
    expect(EsquemaEnvio.safeParse({ ...envioValido(), hp: "bot" }).success).toBe(false);
    expect(
      EsquemaEnvio.safeParse({ ...envioValido(), id: "3f2b6c1e-8d4a-1c2b-9e1f-6a7b8c9d0e1f" })
        .success,
    ).toBe(false);
    expect(EsquemaEnvio.safeParse({ ...envioValido(), edadAnios: 13 }).success).toBe(false);
    expect(EsquemaEnvio.safeParse({ ...envioValido(), edadAnios: 5 }).success).toBe(false);
  });

  it("rechaza instrumento desconocido y codigoVinculo mal formado", () => {
    expect(EsquemaEnvio.safeParse({ ...envioValido(), instrumentoId: "otro" }).success).toBe(false);
    expect(EsquemaEnvio.safeParse({ ...envioValido(), codigoVinculo: "abc" }).success).toBe(false);
  });
});
