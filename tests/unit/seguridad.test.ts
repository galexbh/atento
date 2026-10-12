import { describe, expect, it } from "vitest";
import {
  generarHash,
  ITERACIONES_PBKDF2,
  MAX_ITERACIONES_PBKDF2,
  verificarContrasena,
} from "@/lib/admin/password";
import { faltaSal } from "@/lib/api/limite-tasa";
import { exigeOrigenEstricto, verificarOrigen } from "@/lib/api/origen";
import { verificarTurnstile } from "@/lib/api/turnstile";
import {
  aCsv,
  escaparCsv,
  seudonimizarId,
  tramoEdad,
  validarFiltrosMicrodatos,
} from "@/lib/reportes/exportar";
import type { Filtros } from "@/lib/reportes/filtros";
import { EsquemaEnvio } from "@/lib/validacion/respuesta";
import { obtenerInstrumento } from "../../src/lib/puntuacion/instrumentos";

describe("A1: inyección CSV", () => {
  it("antepone comilla simple a valores que empiezan por =, +, -, @, TAB o CR", () => {
    expect(escaparCsv("=1+1")).toBe("'=1+1");
    expect(escaparCsv("+cmd")).toBe("'+cmd");
    expect(escaparCsv("-1")).toBe("'-1");
    expect(escaparCsv("@SUM(A1)")).toBe("'@SUM(A1)");
    expect(escaparCsv("\tx")).toBe("'\tx");
    expect(escaparCsv("\rx")).toBe('"\'\rx"');
  });

  it("no altera texto normal ni números", () => {
    expect(escaparCsv("hola")).toBe("hola");
    expect(escaparCsv(-3)).toBe("-3");
    expect(escaparCsv(null)).toBe("");
    expect(escaparCsv('a,"b"')).toBe('"a,""b"""');
  });

  it("aCsv aplica el escape a cada celda", () => {
    const csv = aCsv([{ a: '=HYPERLINK("x")', b: 1 }], ["a", "b"]);
    expect(csv).toContain('"\'=HYPERLINK(""x"")",1');
  });
});

describe("A1/B3: esquema de envío", () => {
  const instrumento = obtenerInstrumento("vanderbilt-padres-es-1.0");
  const respuestas: Record<string, number> = {};
  for (const item of instrumento.items) respuestas[item.id] = item.tipo === "desempeno" ? 3 : 1;
  const base = {
    id: "3f2b6c1e-8d4a-4c2b-9e1f-6a7b8c9d0e1f",
    instrumentoId: "vanderbilt-padres-es-1.0",
    respuestas,
    departamento: "08",
    municipio: "0801",
    edadAnios: 8,
    sexo: "F",
    informante: "madre",
    consentimientoInvestigacion: true,
    versionConsentimiento: "2026-10-11",
    completado: true,
    turnstileToken: "t",
    hp: "",
  };

  it("versionConsentimiento solo admite AAAA-MM-DD", () => {
    expect(EsquemaEnvio.safeParse(base).success).toBe(true);
    for (const v of ["v1", "=1+1", "2026-10", "2026-10-11x", ""]) {
      expect(EsquemaEnvio.safeParse({ ...base, versionConsentimiento: v }).success, v).toBe(false);
    }
  });

  it("el mensaje de ítem desconocido no repite el id recibido", () => {
    const r = EsquemaEnvio.safeParse({
      ...base,
      respuestas: { ...respuestas, '<script>alert("x")</script>': 1 },
    });
    expect(r.success).toBe(false);
    if (!r.success) {
      const mensajes = r.error.issues.map((i) => i.message);
      expect(mensajes).toContain("ítem desconocido");
      expect(mensajes.join(" ")).not.toContain("<script>");
    }
  });
});

describe("A2: microdatos", () => {
  const filtros = (extra: Partial<Filtros>): Filtros => ({
    periodo: "2026",
    soloConsentimiento: false,
    ...extra,
  });

  it("rechaza filtros finos y periodos no anuales", () => {
    expect(validarFiltrosMicrodatos(filtros({}))).toBeNull();
    expect(validarFiltrosMicrodatos(filtros({ periodo: "acumulado", departamento: "08" }))).toBe(
      null,
    );
    expect(validarFiltrosMicrodatos(filtros({ municipio: "0801" }))).toMatch(/municipio/);
    expect(validarFiltrosMicrodatos(filtros({ edadMin: 6 }))).toMatch(/edadMin/);
    expect(validarFiltrosMicrodatos(filtros({ edadMax: 9 }))).toMatch(/edadMax/);
    expect(validarFiltrosMicrodatos(filtros({ sexo: "F" }))).toMatch(/sexo/);
    expect(validarFiltrosMicrodatos(filtros({ informante: "madre" }))).toMatch(/informante/);
    expect(validarFiltrosMicrodatos(filtros({ periodo: "2026-03" }))).toMatch(/periodo/);
    expect(validarFiltrosMicrodatos(filtros({ periodo: "2026-Q1" }))).toMatch(/periodo/);
  });

  it("tramos de edad", () => {
    expect([6, 7, 8].map(tramoEdad)).toEqual(["6-8", "6-8", "6-8"]);
    expect([9, 10].map(tramoEdad)).toEqual(["9-10", "9-10"]);
    expect([11, 12].map(tramoEdad)).toEqual(["11-12", "11-12"]);
  });

  it("seudónimo HMAC de 16 hex, estable en el día y distinto entre días o secretos", async () => {
    const id = "3f2b6c1e-8d4a-4c2b-9e1f-6a7b8c9d0e1f";
    const a = await seudonimizarId(id, "secreto", "2026-10-11");
    expect(a).toMatch(/^[0-9a-f]{16}$/);
    expect(await seudonimizarId(id, "secreto", "2026-10-11")).toBe(a);
    expect(await seudonimizarId(id, "secreto", "2026-10-12")).not.toBe(a);
    expect(await seudonimizarId(id, "otro", "2026-10-11")).not.toBe(a);
  });
});

describe("M1: verificación de origen", () => {
  const o = { siteUrl: "https://atento.galexbh.dev", entorno: "produccion", origenPeticion: "x" };

  it("acepta Origin del sitio y rechaza otros", () => {
    expect(verificarOrigen(new Headers({ Origin: "https://atento.galexbh.dev" }), o)).toEqual({
      permitido: true,
    });
    expect(verificarOrigen(new Headers({ Origin: "https://evil.example" }), o).permitido).toBe(
      false,
    );
    expect(verificarOrigen(new Headers({ Origin: "null" }), o).permitido).toBe(false);
  });

  it("Origin: null (Referrer-Policy no-referrer) se decide por Sec-Fetch-Site", () => {
    const propio = new Headers({ Origin: "null", "Sec-Fetch-Site": "same-origin" });
    expect(verificarOrigen(propio, o).permitido).toBe(true);
    const ajeno = new Headers({ Origin: "null", "Sec-Fetch-Site": "cross-site" });
    expect(verificarOrigen(ajeno, o).permitido).toBe(false);
  });

  it("sin Origin usa Sec-Fetch-Site; sin ambas rechaza en producción y acepta en local", () => {
    expect(verificarOrigen(new Headers({ "Sec-Fetch-Site": "same-origin" }), o).permitido).toBe(
      true,
    );
    expect(verificarOrigen(new Headers({ "Sec-Fetch-Site": "cross-site" }), o).permitido).toBe(
      false,
    );
    expect(verificarOrigen(new Headers(), o).permitido).toBe(false);
    expect(verificarOrigen(new Headers(), { ...o, entorno: "local" }).permitido).toBe(true);
  });

  it("exige comprobación estricta solo en métodos mutadores bajo /admin y /api/admin", () => {
    expect(exigeOrigenEstricto("/admin/sistema", "POST")).toBe(true);
    expect(exigeOrigenEstricto("/admin", "POST")).toBe(true);
    expect(exigeOrigenEstricto("/api/admin/entrar", "POST")).toBe(true);
    expect(exigeOrigenEstricto("/admin/sistema", "GET")).toBe(false);
    expect(exigeOrigenEstricto("/api/respuesta", "POST")).toBe(false);
    expect(exigeOrigenEstricto("/administracion", "POST")).toBe(false);
  });
});

describe("M3: sal del límite de tasa", () => {
  it("falta solo en producción sin RATE_SALT", () => {
    expect(faltaSal("produccion", undefined)).toBe(true);
    expect(faltaSal("produccion", "")).toBe(true);
    expect(faltaSal("produccion", "x")).toBe(false);
    expect(faltaSal("preview", undefined)).toBe(false);
    expect(faltaSal("local", undefined)).toBe(false);
  });
});

describe("B10: Turnstile fail-closed fuera de local", () => {
  it("sin secreto solo pasa en local/test", async () => {
    const base = { secreto: "", token: "abc" };
    expect(await verificarTurnstile({ ...base, entorno: "local" })).toBe(true);
    expect(await verificarTurnstile({ ...base, entorno: "test" })).toBe(true);
    expect(await verificarTurnstile({ ...base, entorno: "local", token: "" })).toBe(false);
    expect(await verificarTurnstile({ ...base, entorno: "preview" })).toBe(false);
    expect(await verificarTurnstile({ ...base, entorno: "produccion" })).toBe(false);
    expect(await verificarTurnstile({ ...base, entorno: undefined })).toBe(false);
  });

  it("la clave de prueba de Cloudflare se rechaza en preview y producción", async () => {
    const base = { secreto: "1x0000000000000000000000000000000AA", token: "abc" };
    expect(await verificarTurnstile({ ...base, entorno: "local" })).toBe(true);
    expect(await verificarTurnstile({ ...base, entorno: "preview" })).toBe(false);
    expect(await verificarTurnstile({ ...base, entorno: "produccion" })).toBe(false);
  });
});

describe("PBKDF2 compatible con Cloudflare Workers", () => {
  it("genera 100 000 iteraciones y rechaza hashes con más", async () => {
    expect(ITERACIONES_PBKDF2).toBe(100_000);
    expect(MAX_ITERACIONES_PBKDF2).toBe(100_000);
    const hash = await generarHash("contrasena-de-prueba-2026");
    expect(hash.startsWith("pbkdf2$100000$")).toBe(true);
    expect(await verificarContrasena("contrasena-de-prueba-2026", hash)).toBe(true);
    const demasiadas = hash.replace("pbkdf2$100000$", "pbkdf2$200000$");
    expect(await verificarContrasena("contrasena-de-prueba-2026", demasiadas)).toBe(false);
    const pocas = hash.replace("pbkdf2$100000$", "pbkdf2$5000$");
    expect(await verificarContrasena("contrasena-de-prueba-2026", pocas)).toBe(false);
  });
});
