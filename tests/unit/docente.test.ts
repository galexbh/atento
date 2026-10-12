import { describe, expect, it } from "vitest";
import { agregar, type FilaRespuesta, VERSION_TODAS } from "../../src/lib/agregados/calcular";
import { construirHojaDocente, TEXTO_NO_ES_RESULTADO } from "../../src/lib/cliente/hoja-docente";
import { ordenarItemsDocente, paginasDe } from "../../src/lib/cliente/orden";
import {
  esCodigoVinculoValido,
  formatearCodigo,
  leerCodigoVinculo,
  normalizarCodigoVinculo,
} from "../../src/lib/compartido/codigo-vinculo";
import { construirFila } from "../../src/lib/db/respuestas";
import { SQL_ANIOS_CON_DATOS, SQL_CONTEOS_ANIO } from "../../src/lib/publico/consultar";
import { obtenerInstrumento } from "../../src/lib/puntuacion/instrumentos";
import { type Envio, EsquemaEnvio } from "../../src/lib/validacion/respuesta";

const DOC = "vanderbilt-docente-es-1.0";
const docente = obtenerInstrumento(DOC);
const padres = obtenerInstrumento("vanderbilt-padres-es-1.0");

function respuestas(inst = docente, frecuencia = 1, desempeno = 3): Record<string, number> {
  const r: Record<string, number> = {};
  for (const item of inst.items) r[item.id] = item.tipo === "desempeno" ? desempeno : frecuencia;
  return r;
}

function envioDocente(extra: Partial<Envio> = {}): Envio {
  return {
    id: "3f2b6c1e-8d4a-4c2b-9e1f-6a7b8c9d0e1f",
    instrumentoId: DOC,
    respuestas: respuestas(),
    departamento: "08",
    municipio: "0801",
    edadAnios: 9,
    sexo: "M",
    informante: "docente",
    consentimientoInvestigacion: true,
    versionConsentimiento: "2026-10-12",
    duracionSegundos: 360,
    completado: true,
    codigoVinculo: "ABCD2345",
    turnstileToken: "token-de-prueba",
    hp: "",
    ...extra,
  };
}

function rutas(r: ReturnType<typeof EsquemaEnvio.safeParse>): string[] {
  return r.success ? [] : r.error.issues.map((i) => i.path.join("."));
}

describe("EsquemaEnvio – informante cruzado", () => {
  it("acepta un envío docente válido, con y sin código de vínculo", () => {
    expect(EsquemaEnvio.safeParse(envioDocente()).success).toBe(true);
    const { codigoVinculo: _c, ...sinCodigo } = envioDocente();
    expect(EsquemaEnvio.safeParse(sinCodigo).success).toBe(true);
  });

  it("el instrumento docente solo admite informante 'docente'", () => {
    for (const informante of ["madre", "padre", "cuidador"] as const) {
      const r = EsquemaEnvio.safeParse(envioDocente({ informante }));
      expect(r.success, informante).toBe(false);
      expect(rutas(r)).toContain("informante");
    }
  });

  it("el instrumento de padres (y Atento) no admite informante 'docente'", () => {
    const r = EsquemaEnvio.safeParse(
      envioDocente({ instrumentoId: "vanderbilt-padres-es-1.0", respuestas: respuestas(padres) }),
    );
    expect(r.success).toBe(false);
    expect(rutas(r)).toContain("informante");
    const atento = obtenerInstrumento("atento-0.1");
    const r2 = EsquemaEnvio.safeParse(
      envioDocente({ instrumentoId: "atento-0.1", respuestas: respuestas(atento) }),
    );
    expect(rutas(r2)).toContain("informante");
  });

  it("el instrumento docente no admite respuestasAtento (ni siquiera vacío)", () => {
    expect(rutas(EsquemaEnvio.safeParse(envioDocente({ respuestasAtento: { A01: 1 } })))).toContain(
      "respuestasAtento",
    );
    expect(EsquemaEnvio.safeParse(envioDocente({ respuestasAtento: {} })).success).toBe(false);
  });

  it("rechaza ítems de padres en el instrumento docente y rangos inválidos", () => {
    expect(EsquemaEnvio.safeParse(envioDocente({ respuestas: { V01: 1 } })).success).toBe(false);
    expect(EsquemaEnvio.safeParse(envioDocente({ respuestas: { T40: 6 } })).success).toBe(false);
    expect(EsquemaEnvio.safeParse(envioDocente({ respuestas: { T01: 3 } })).success).toBe(true);
  });

  it("el servidor sigue exigiendo el código ya normalizado (8 alfanuméricos)", () => {
    expect(EsquemaEnvio.safeParse(envioDocente({ codigoVinculo: "ABCD-2345" })).success).toBe(
      false,
    );
    expect(EsquemaEnvio.safeParse(envioDocente({ codigoVinculo: "ABC" })).success).toBe(false);
  });

  it("construirFila guarda informante docente, código y puntuación de investigación", () => {
    const envio = envioDocente({ respuestas: respuestas(docente, 3, 5) });
    const fila = construirFila(envio, new Date("2026-10-12T15:00:00Z"));
    expect(fila).toMatchObject({
      informante: "docente",
      version_instrumento: DOC,
      codigo_vinculo: "ABCD2345",
      pos_inatencion: 1,
      pos_hiperactividad: 1,
      pos_oposicion: 0,
      pos_conducta: 1,
      pos_desempeno: 1,
      punt_oposicion: 0,
      punt_conducta: 30,
      punt_desempeno: 40,
      nivel: "alto",
      creado_en: "2026-10-12",
    });
    expect(JSON.parse(fila.items)).not.toHaveProperty("atento");
  });
});

describe("código de vínculo", () => {
  it("normaliza mayúsculas y quita espacios, guiones y puntos", () => {
    expect(normalizarCodigoVinculo(" abcd-2345 ")).toBe("ABCD2345");
    expect(normalizarCodigoVinculo("ab cd 23 45")).toBe("ABCD2345");
    expect(normalizarCodigoVinculo("ABCD–2345")).toBe("ABCD2345"); // guion largo
    expect(normalizarCodigoVinculo("ab.cd.23.45")).toBe("ABCD2345");
    expect(normalizarCodigoVinculo(null)).toBe("");
  });

  it("valida 8 alfanuméricos tras normalizar", () => {
    expect(leerCodigoVinculo("abcd-2345")).toBe("ABCD2345");
    expect(leerCodigoVinculo("abcd-234")).toBeNull();
    expect(leerCodigoVinculo("abcd-23456")).toBeNull();
    expect(leerCodigoVinculo("abcd-23ñ5")).toBeNull();
    expect(leerCodigoVinculo("")).toBeNull();
    expect(esCodigoVinculoValido("ABCD2345")).toBe(true);
    expect(esCodigoVinculoValido("abcd2345")).toBe(false);
    expect(formatearCodigo("ABCD2345")).toBe("ABCD-2345");
  });
});

describe("hoja imprimible del docente", () => {
  it("cuenta marcados (2–3) por escala y desempeño con 4–5, sin nivel ni umbrales", () => {
    const r = respuestas(docente, 0, 3);
    r.T01 = 2;
    r.T02 = 3;
    r.T03 = 1;
    r.T19 = 3;
    r.T37 = 4;
    r.T41 = 5;
    delete r.T35;
    const hoja = construirHojaDocente({
      instrumentoId: DOC,
      respuestas: r,
      edadAnios: 9,
      codigoVinculo: "ABCD2345",
      investigacion: true,
      guardado: true,
      fecha: "2026-10-12T00:00:00.000Z",
    });
    expect(hoja.escalas).toEqual([
      { escala: "inatencion", marcados: 2, respondidos: 9, total: 9 },
      { escala: "hiperactividad", marcados: 0, respondidos: 9, total: 9 },
      { escala: "conducta", marcados: 1, respondidos: 10, total: 10 },
      { escala: "ansiedad_depresion", marcados: 0, respondidos: 6, total: 7 },
    ]);
    expect(hoja.desempenoConDificultad.map((d) => [d.numero, d.texto, d.etiqueta])).toEqual([
      [37, "Matemáticas", "Cierta dificultad"],
      [41, "Conducta en clase", "Con dificultad"],
    ]);
    expect(hoja.desempenoTotal).toBe(8);
    const json = JSON.stringify(hoja);
    for (const prohibido of ["nivel", "umbral", "positivo", "alto", "moderado", "bajo"]) {
      expect(json).not.toContain(prohibido);
    }
    expect(TEXTO_NO_ES_RESULTADO).toBe(
      "Para entregar a la familia o al profesional de salud. No es un diagnóstico ni un resultado.",
    );
  });

  it("orden docente: 35 de frecuencia en 6 páginas y el desempeño en una última página", () => {
    const items = ordenarItemsDocente(DOC);
    expect(items).toHaveLength(43);
    expect(paginasDe(items)).toBe(7);
    expect(items.filter((o) => o.pagina === 6).map((o) => o.item.id)).toEqual([
      "T36",
      "T37",
      "T38",
      "T39",
      "T40",
      "T41",
      "T42",
      "T43",
    ]);
    expect(items.every((o) => o.item.tipo === "desempeno" || o.pagina < 6)).toBe(true);
  });
});

describe("las respuestas docentes no cuentan en el mapa", () => {
  const fila = (parcial: Partial<FilaRespuesta>): FilaRespuesta => ({
    creado_en: "2026-10-05",
    departamento: "08",
    municipio: "0801",
    pos_inatencion: 1,
    pos_hiperactividad: 0,
    version_instrumento: "vanderbilt-padres-es-1.0",
    ...parcial,
  });

  it("agregar(): el docente solo se agrega en su propia versión, nunca en 'todas'", () => {
    const filas = [
      ...Array.from({ length: 6 }, () => fila({})),
      ...Array.from({ length: 7 }, () => fila({ version_instrumento: DOC })),
    ];
    const salida = agregar(filas);
    const todas = salida.find(
      (f) =>
        f.periodo === "2026" && f.municipio === "0801" && f.version_instrumento === VERSION_TODAS,
    );
    const soloDocente = salida.find(
      (f) => f.periodo === "2026" && f.municipio === "0801" && f.version_instrumento === DOC,
    );
    expect(todas?.n).toBe(6);
    expect(soloDocente?.n).toBe(7);
  });

  it("la consulta de la publicación pública excluye el instrumento docente", () => {
    expect(SQL_CONTEOS_ANIO).toContain("version_instrumento NOT IN ('vanderbilt-docente-es-1.0')");
    expect(SQL_ANIOS_CON_DATOS).toContain(
      "version_instrumento NOT IN ('vanderbilt-docente-es-1.0')",
    );
  });
});
