import { env, exports } from "cloudflare:workers";
import { beforeEach, describe, expect, it } from "vitest";
import { ejecutarCronDiario } from "@/lib/agregados/recalcular";
import { COLUMNAS_RESPUESTA, type FilaRespuestaNueva } from "@/lib/db/respuestas";
import type { Publicacion } from "@/lib/publico/datos";
import { obtenerPublicacion, publicarAnios } from "@/lib/publico/publicar";

const ORIGEN = "https://atento.galexbh.dev";

function fila(parcial: Partial<FilaRespuestaNueva>): FilaRespuestaNueva {
  const creado = parcial.creado_en ?? "2026-10-05";
  return {
    id: crypto.randomUUID(),
    creado_en: creado,
    periodo_anio: Number(creado.slice(0, 4)),
    departamento: "08",
    municipio: "0801",
    edad_anios: 8,
    sexo: "F",
    informante: "madre",
    items: "{}",
    punt_inatencion: 0,
    punt_hiperactividad: 0,
    punt_oposicion: 0,
    punt_conducta: 0,
    punt_ansiedad_depresion: 0,
    punt_desempeno: 0,
    pos_inatencion: 0,
    pos_hiperactividad: 0,
    pos_oposicion: 0,
    pos_conducta: 0,
    pos_ansiedad_depresion: 0,
    pos_desempeno: 0,
    nivel: "bajo",
    consentimiento_investigacion: 1,
    version_consentimiento: "2026-10-11",
    version_instrumento: "vanderbilt-padres-es-1.0",
    duracion_segundos: 300,
    completado: 1,
    item_abandono: null,
    codigo_vinculo: null,
    ...parcial,
  };
}

async function insertar(filas: FilaRespuestaNueva[]) {
  const sql = `INSERT INTO respuestas (${COLUMNAS_RESPUESTA.join(", ")}) VALUES (${COLUMNAS_RESPUESTA.map(() => "?").join(", ")})`;
  await env.DB.batch(
    filas.map((f) => env.DB.prepare(sql).bind(...COLUMNAS_RESPUESTA.map((c) => f[c]))),
  );
}

async function limpiar() {
  await env.DB.batch([
    env.DB.prepare("DELETE FROM respuestas"),
    env.DB.prepare("DELETE FROM agregados_municipio"),
    env.DB.prepare("DELETE FROM agregados_anuales"),
    env.DB.prepare("DELETE FROM publicaciones"),
  ]);
  const claves = await env.CACHE.list({ prefix: "agregado:" });
  await Promise.all(claves.keys.map((k) => env.CACHE.delete(k.name)));
}

const repetir = (k: number, p: Partial<FilaRespuestaNueva>) =>
  Array.from({ length: k }, () => fila(p));

/**
 * 2026: Distrito Central 10 (3 con inatención), Lepaterique 3 (primaria), Alubarén 6
 * (complementaria), Comayagua 8. Más filas que no cuentan: sin consentimiento e incompletas.
 * 2025: Distrito Central 7.
 */
async function sembrar() {
  await insertar([
    ...repetir(3, { pos_inatencion: 1 }),
    ...repetir(7, {}),
    ...repetir(3, { municipio: "0809", creado_en: "2026-02-14", pos_hiperactividad: 1 }),
    ...repetir(6, { municipio: "0802", creado_en: "2026-05-02" }),
    ...repetir(8, { departamento: "03", municipio: "0301", creado_en: "2026-08-20" }),
    ...repetir(4, { municipio: "0803", consentimiento_investigacion: 0 }),
    ...repetir(2, { municipio: "0803", completado: 0 }),
    ...repetir(7, { creado_en: "2025-06-01", pos_inatencion: 1 }),
  ]);
}

describe("publicarAnios", () => {
  beforeEach(async () => {
    await limpiar();
    await sembrar();
  });

  it("año en curso preliminar (se sobrescribe); años cerrados v1 inmutable", async () => {
    const r1 = await publicarAnios(env, new Date("2026-10-11T03:00:00Z"));
    expect(r1).toEqual({ preliminares: [2026], cerrados: [2025] });

    const filas = await env.DB.prepare(
      "SELECT anio, version, preliminar, generado_en FROM publicaciones ORDER BY anio, version",
    ).all<{ anio: number; version: string; preliminar: number; generado_en: string }>();
    expect(filas.results).toEqual([
      { anio: 2025, version: "v1", preliminar: 0, generado_en: "2026-10-11T03:00:00.000Z" },
      { anio: 2026, version: "preliminar", preliminar: 1, generado_en: "2026-10-11T03:00:00.000Z" },
    ]);

    // Llegan más datos de 2025 y 2026: la preliminar se sobrescribe; la v1 no cambia.
    await insertar([
      ...repetir(5, { creado_en: "2025-07-01" }),
      ...repetir(5, { municipio: "0803" }),
    ]);
    const r2 = await publicarAnios(env, new Date("2026-10-12T03:00:00Z"));
    expect(r2).toEqual({ preliminares: [2026], cerrados: [] });
    const p2026 = await obtenerPublicacion(env, 2026);
    // Preliminar con corte al cierre del 3.er trimestre: las respuestas de octubre (abierto) no
    // cuentan, así que el total no cambia aunque lleguen datos nuevos dentro del trimestre.
    expect(p2026?.corte).toBe("2026-Q3");
    expect(p2026?.nacional.n).toBe(17);
    expect(p2026?.municipios).toEqual([]);
    expect(p2026?.serieTrimestral.map((t) => t.codigo)).toEqual(["2026-Q1", "2026-Q2", "2026-Q3"]);
    expect(p2026?.generadoEn).toBe("2026-10-12T03:00:00.000Z");
    const p2025 = await obtenerPublicacion(env, 2025);
    expect(p2025).toMatchObject({ versionDataset: "v1", preliminar: false });
    expect(p2025?.nacional.n).toBe(7);

    // La base de datos impide modificar una versión cerrada.
    await expect(
      env.DB.prepare(
        "UPDATE publicaciones SET datos = '{}' WHERE anio = 2025 AND version = 'v1'",
      ).run(),
    ).rejects.toThrow();

    // Al cerrarse 2026 (cron del 1 de enero) se crea su v1 y se borra la preliminar.
    const cron = await ejecutarCronDiario(env, new Date("2027-01-01T03:00:00Z"));
    expect(cron.publicaciones.cerrados).toEqual([2026]);
    const v2026 = await env.DB.prepare(
      "SELECT version FROM publicaciones WHERE anio = 2026 ORDER BY version",
    ).all<{ version: string }>();
    expect(v2026.results.map((r) => r.version)).toEqual(["v1"]);
  });

  it("sin publicaciones guardadas calcula al vuelo y guarda la preliminar", async () => {
    const p = await obtenerPublicacion(env, 2026, new Date("2026-10-11T03:00:00Z"));
    expect(p?.versionDataset).toBe("preliminar");
    const guardada = await env.DB.prepare(
      "SELECT count(*) AS n FROM publicaciones WHERE anio = 2026 AND version = 'preliminar'",
    ).first<{ n: number }>();
    expect(guardada?.n).toBe(1);
    expect(await obtenerPublicacion(env, 1999)).toBeNull();
  });
});

describe("GET /api/publico/datos", () => {
  beforeEach(async () => {
    await limpiar();
    await sembrar();
    // 2026 ya cerrado: versión v1 completa (con municipios y los cuatro trimestres).
    await publicarAnios(env, new Date("2027-01-02T03:00:00Z"));
  });

  it("JSON con supresión, caché, ETag/304 y licencia", async () => {
    const url = `${ORIGEN}/api/publico/datos?anio=2026`;
    const r1 = await exports.default.fetch(url);
    expect(r1.status).toBe(200);
    expect(r1.headers.get("Content-Type")).toContain("application/json");
    expect(r1.headers.get("Cache-Control")).toBe("public, max-age=300, s-maxage=3600");
    expect(r1.headers.get("Link")).toContain("creativecommons.org/licenses/by/4.0");
    expect(r1.headers.get("X-Cache")).toBe("MISS");
    const p = await r1.json<Publicacion>();
    expect(p).toMatchObject({ anio: 2026, preliminar: false, versionDataset: "v1" });
    expect(p.nacional.n).toBe(27);
    expect(p.departamentos.map((d) => [d.codigo, d.n])).toEqual([
      ["03", 8],
      ["08", 19],
    ]);
    const m = new Map(p.municipios.map((x) => [x.codigo, x]));
    expect(m.get("0801")).toMatchObject({ n: 10, pctIndicadores: 30, suprimido: false });
    expect(m.get("0809")).toMatchObject({ n: null, suprimido: true, pctIndicadores: null });
    expect(m.get("0802")).toMatchObject({ n: null, suprimido: true });
    expect(m.has("0803")).toBe(false); // sin consentimiento o incompletas: no cuentan
    // Serie: Q1 = 3 (primaria) arrastra Q2 = 6; Q3 = 8; Q4 = 10.
    expect(p.serieTrimestral.map((t) => [t.codigo, t.n])).toEqual([
      ["2026-Q1", null],
      ["2026-Q2", null],
      ["2026-Q3", 8],
      ["2026-Q4", 10],
    ]);

    const etag = r1.headers.get("ETag") as string;
    const r2 = await exports.default.fetch(url, { headers: { "If-None-Match": etag } });
    expect(r2.status).toBe(304);
    expect(r2.headers.get("X-Cache")).toBe("HIT");
  });

  it("CSV UTF-8 con BOM y nombre de archivo versionado", async () => {
    const r = await exports.default.fetch(`${ORIGEN}/api/publico/datos?anio=2026&formato=csv`);
    expect(r.status).toBe(200);
    expect(r.headers.get("Content-Type")).toBe("text/csv; charset=utf-8");
    expect(r.headers.get("Content-Disposition")).toBe(
      'attachment; filename="atento-datos-2026-v1.csv"',
    );
    const bytes = new Uint8Array(await r.arrayBuffer());
    expect([...bytes.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
    const texto = new TextDecoder().decode(bytes.slice(3));
    const lineas = texto.trim().split("\r\n");
    expect(lineas[0]?.split(",")).toHaveLength(13);
    expect(lineas).toContain("municipio,0809,Lepaterique,2026,,,,,,,1,v1,0");
    expect(lineas.some((l) => l.startsWith("departamento,08,Francisco Morazán,2026,19,"))).toBe(
      true,
    );

    const cerrado = await exports.default.fetch(
      `${ORIGEN}/api/publico/datos?anio=2025&formato=csv`,
    );
    expect(cerrado.headers.get("Content-Disposition")).toContain("atento-datos-2025-v1.csv");
  });

  it("404 sin datos publicables y 400 con meses, trimestres u otros parámetros", async () => {
    const r404 = await exports.default.fetch(`${ORIGEN}/api/publico/datos?anio=1999`);
    expect(r404.status).toBe(404);
    for (const q of [
      "anio=2026-Q4",
      "anio=2026-10",
      "anio=acumulado",
      "anio=2026&trimestre=4",
      "anio=2026&mes=10",
      "anio=2026&formato=xlsx",
      "",
    ]) {
      const r = await exports.default.fetch(`${ORIGEN}/api/publico/datos?${q}`);
      expect(r.status, q).toBe(400);
    }
  });

  it("GET /api/publico/anios lista años con su versión", async () => {
    const r = await exports.default.fetch(`${ORIGEN}/api/publico/anios`);
    expect(r.status).toBe(200);
    const { anios } = await r.json<{
      anios: { anio: number; version: string; preliminar: boolean }[];
    }>();
    expect(anios.map((a) => [a.anio, a.version, a.preliminar])).toEqual([
      [2026, "v1", false],
      [2025, "v1", false],
    ]);
  });
});
