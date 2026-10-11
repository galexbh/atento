import { env, exports } from "cloudflare:workers";
import { beforeEach, describe, expect, it } from "vitest";
import { ejecutarCronDiario, recalcularAgregados } from "@/lib/agregados/recalcular";
import { COLUMNAS_RESPUESTA, type FilaRespuestaNueva } from "@/lib/db/respuestas";

const ORIGEN = "https://atento.galexbh.dev";

function fila(parcial: Partial<FilaRespuestaNueva>): FilaRespuestaNueva {
  return {
    id: crypto.randomUUID(),
    creado_en: "2026-10-05",
    periodo_anio: 2026,
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
    version_consentimiento: "v1",
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

interface Dato {
  codigo: string;
  nombre: string;
  n: number;
  pct: number | null;
  ic95: [number, number] | null;
  suprimido: boolean;
}
interface Agregado {
  periodo: string;
  nivel: string;
  version: string;
  calculadoEn: string | null;
  datos: Dato[];
}

/** El almacenamiento persiste entre pruebas del mismo archivo: se limpia explícitamente. */
async function limpiar() {
  await env.DB.batch([
    env.DB.prepare("DELETE FROM respuestas"),
    env.DB.prepare("DELETE FROM agregados_municipio"),
    env.DB.prepare("DELETE FROM agregados_anuales"),
  ]);
  const claves = await env.CACHE.list({ prefix: "agregado:" });
  await Promise.all(claves.keys.map((k) => env.CACHE.delete(k.name)));
}

/** Semilla: Tegucigalpa (0801) 10 filas con 3 positivas; Valle de Ángeles (0809) 3 filas. */
async function sembrar() {
  const filas: FilaRespuestaNueva[] = [];
  for (let i = 0; i < 10; i++) {
    filas.push(fila({ pos_inatencion: i < 3 ? 1 : 0, pos_hiperactividad: i === 0 ? 1 : 0 }));
  }
  for (let i = 0; i < 3; i++) {
    filas.push(fila({ municipio: "0809", pos_inatencion: 1, creado_en: "2026-02-14" }));
  }
  // Un cribado incompleto no cuenta.
  filas.push(fila({ municipio: "0809", completado: 0 }));
  await insertar(filas);
}

describe("agregados", () => {
  beforeEach(async () => {
    await limpiar();
    await sembrar();
  });

  it("recalcularAgregados escribe filas por periodo, municipio, departamento y versión", async () => {
    const r = await recalcularAgregados(env, new Date("2026-10-11T03:00:00Z"));
    expect(r.filasLeidas).toBe(13);
    expect(r.calculadoEn).toBe("2026-10-11T03:00:00.000Z");

    const periodos = await env.DB.prepare(
      "SELECT DISTINCT periodo FROM agregados_municipio ORDER BY periodo",
    ).all<{ periodo: string }>();
    expect(periodos.results.map((p) => p.periodo)).toEqual([
      "2026",
      "2026-02",
      "2026-10",
      "2026-Q1",
      "2026-Q4",
      "acumulado",
    ]);

    const tegus = await env.DB.prepare(
      "SELECT * FROM agregados_municipio WHERE periodo = 'acumulado' AND municipio = '0801' AND version_instrumento = 'todas'",
    ).first<Record<string, unknown>>();
    expect(tegus?.n).toBe(10);
    expect(tegus?.pct_inatencion).toBe(30);
    expect(tegus?.pct_hiperactividad).toBe(10);
    expect(tegus?.pct_combinado).toBe(30);
    expect(tegus?.pct_ambas).toBe(10);
    expect(tegus?.suprimido).toBe(0);
    expect(tegus?.ic95_inf).toBeCloseTo(10.78, 1);
    expect(tegus?.ic95_sup).toBeCloseTo(60.32, 1);

    const valle = await env.DB.prepare(
      "SELECT * FROM agregados_municipio WHERE periodo = 'acumulado' AND municipio = '0809' AND version_instrumento = 'vanderbilt-padres-es-1.0'",
    ).first<Record<string, unknown>>();
    expect(valle?.n).toBe(3);
    expect(valle?.suprimido).toBe(1);
    expect(valle?.pct_combinado).toBeNull();
    expect(valle?.ic95_inf).toBeNull();

    const depto = await env.DB.prepare(
      "SELECT * FROM agregados_municipio WHERE periodo = 'acumulado' AND municipio = '0800' AND version_instrumento = 'todas'",
    ).first<Record<string, unknown>>();
    expect(depto?.departamento).toBe("08");
    expect(depto?.n).toBe(13);
    expect(depto?.pct_combinado).toBeCloseTo(46.15, 2);

    // Una segunda corrida sustituye y elimina lo obsoleto.
    await env.DB.prepare("DELETE FROM respuestas WHERE municipio = '0809'").run();
    await recalcularAgregados(env, new Date("2026-10-12T03:00:00Z"));
    const restantes = await env.DB.prepare(
      "SELECT count(*) AS n FROM agregados_municipio WHERE municipio = '0809' OR periodo = '2026-02'",
    ).first<{ n: number }>();
    expect(restantes?.n).toBe(0);
    const viejas = await env.DB.prepare(
      "SELECT count(*) AS n FROM agregados_municipio WHERE calculado_en <> '2026-10-12T03:00:00.000Z'",
    ).first<{ n: number }>();
    expect(viejas?.n).toBe(0);
  });

  it("GET /api/agregado: supresión, nombres de catálogo, caché KV y ETag", async () => {
    await recalcularAgregados(env);
    const url = `${ORIGEN}/api/agregado?periodo=acumulado&nivel=municipio&version=todas`;

    const r1 = await exports.default.fetch(url);
    expect(r1.status).toBe(200);
    expect(r1.headers.get("X-Cache")).toBe("MISS");
    expect(r1.headers.get("Cache-Control")).toBe("public, max-age=300, s-maxage=3600");
    const etag = r1.headers.get("ETag");
    expect(etag).toMatch(/^"[0-9a-f]{32}"$/);
    const cuerpo = await r1.json<Agregado>();
    expect(cuerpo.periodo).toBe("acumulado");
    expect(cuerpo.nivel).toBe("municipio");
    expect(cuerpo.calculadoEn).not.toBeNull();
    const tegus = cuerpo.datos.find((d) => d.codigo === "0801");
    expect(tegus).toMatchObject({ nombre: "Distrito Central", n: 10, pct: 30, suprimido: false });
    expect(tegus?.ic95?.[0]).toBeLessThan(30);
    expect(tegus?.ic95?.[1]).toBeGreaterThan(30);
    const valle = cuerpo.datos.find((d) => d.codigo === "0809");
    expect(valle).toMatchObject({ n: 3, pct: null, ic95: null, suprimido: true });
    // Las filas de departamento ("xx00") no aparecen en nivel municipio.
    expect(cuerpo.datos.some((d) => d.codigo.endsWith("00"))).toBe(false);

    // Segunda lectura: desde KV.
    const r2 = await exports.default.fetch(url);
    expect(r2.headers.get("X-Cache")).toBe("HIT");
    expect(r2.headers.get("ETag")).toBe(etag);
    const enKv = await env.CACHE.get("agregado:acumulado:municipio:todas");
    expect(enKv).not.toBeNull();

    // ETag: 304.
    const r3 = await exports.default.fetch(url, { headers: { "If-None-Match": etag as string } });
    expect(r3.status).toBe(304);

    // Nivel departamento con nombre del catálogo.
    const r4 = await exports.default.fetch(
      `${ORIGEN}/api/agregado?periodo=2026-Q4&nivel=departamento`,
    );
    const deptos = await r4.json<Agregado>();
    expect(deptos.version).toBe("todas");
    expect(deptos.datos).toHaveLength(1);
    expect(deptos.datos[0]).toMatchObject({ codigo: "08", nombre: "Francisco Morazán", n: 10 });

    // Recalcular invalida la caché.
    await recalcularAgregados(env);
    expect(await env.CACHE.get("agregado:acumulado:municipio:todas")).toBeNull();
  });

  it("GET /api/agregado valida parámetros", async () => {
    for (const q of [
      "periodo=2026-13",
      "periodo=acumulado&nivel=pais",
      "periodo=x",
      "periodo=2026&otro=1",
      "",
    ]) {
      const r = await exports.default.fetch(`${ORIGEN}/api/agregado?${q}`);
      expect(r.status, q).toBe(400);
      expect((await r.json<{ ok: boolean }>()).ok).toBe(false);
    }
    // Un periodo válido sin datos responde 200 con lista vacía.
    const r = await exports.default.fetch(`${ORIGEN}/api/agregado?periodo=2019`);
    expect(r.status).toBe(200);
    expect((await r.json<Agregado>()).datos).toEqual([]);
  });

  it("GET /api/agregado/periodos lista periodos y versiones", async () => {
    await recalcularAgregados(env);
    const r = await exports.default.fetch(`${ORIGEN}/api/agregado/periodos`);
    expect(r.status).toBe(200);
    const cuerpo = await r.json<{ periodos: string[]; versiones: string[]; calculadoEn: string }>();
    expect(cuerpo.periodos).toContain("acumulado");
    expect(cuerpo.periodos).toContain("2026-Q4");
    expect(cuerpo.versiones).toEqual(["todas", "vanderbilt-padres-es-1.0"]);
    expect(cuerpo.calculadoEn).toBeTruthy();
  });

  it("cron del 1 de enero crea el snapshot anual una sola vez", async () => {
    const r1 = await ejecutarCronDiario(env, new Date("2027-01-01T03:00:00Z"));
    expect(r1.snapshot).toBe(2026);
    const anuales = await env.DB.prepare(
      "SELECT count(*) AS n, min(version_dataset) AS v FROM agregados_anuales WHERE periodo = '2026'",
    ).first<{ n: number; v: string }>();
    expect(anuales?.n).toBeGreaterThan(0);
    expect(anuales?.v).toBe("v1");
    const r2 = await ejecutarCronDiario(env, new Date("2027-01-01T03:00:00Z"));
    expect(r2.snapshot).toBeNull();
    const r3 = await ejecutarCronDiario(env, new Date("2027-01-02T03:00:00Z"));
    expect(r3.snapshot).toBeNull();
  });
});

describe("GET /api/geo", () => {
  it("sirve el GeoJSON de departamentos con caché larga y ETag", async () => {
    const r = await exports.default.fetch(`${ORIGEN}/api/geo?nivel=departamento`);
    expect(r.status).toBe(200);
    expect(r.headers.get("Content-Type")).toContain("application/geo+json");
    expect(r.headers.get("Cache-Control")).toContain("max-age=86400");
    const geo = await r.json<{ type: string; features: { properties: { codigo: string } }[] }>();
    expect(geo.type).toBe("FeatureCollection");
    expect(geo.features).toHaveLength(18);
    const r304 = await exports.default.fetch(`${ORIGEN}/api/geo`, {
      headers: { "If-None-Match": r.headers.get("ETag") as string },
    });
    expect(r304.status).toBe(304);
    expect((await exports.default.fetch(`${ORIGEN}/api/geo?nivel=municipio`)).status).toBe(404);
    expect((await exports.default.fetch(`${ORIGEN}/api/geo?nivel=pais`)).status).toBe(400);
  });
});
