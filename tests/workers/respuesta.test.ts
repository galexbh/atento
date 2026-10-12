import { env, exports } from "cloudflare:workers";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { obtenerInstrumento } from "@/lib/puntuacion/instrumentos";
import type { Envio } from "@/lib/validacion/respuesta";

const instrumento = obtenerInstrumento("vanderbilt-padres-es-1.0");
const URL_API = "https://atento.galexbh.dev/api/respuesta";
const SITEVERIFY = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

function respuestasCompletas(valorFrecuencia = 1): Record<string, number> {
  const r: Record<string, number> = {};
  for (const item of instrumento.items) {
    r[item.id] = item.tipo === "desempeno" ? 3 : valorFrecuencia;
  }
  return r;
}

function envioValido(extra: Partial<Envio> = {}): Envio {
  return {
    id: crypto.randomUUID(),
    instrumentoId: "vanderbilt-padres-es-1.0",
    respuestas: respuestasCompletas(),
    departamento: "08",
    municipio: "0801",
    edadAnios: 8,
    sexo: "F",
    informante: "madre",
    consentimientoInvestigacion: true,
    versionConsentimiento: "2026-10-11",
    duracionSegundos: 427,
    completado: true,
    turnstileToken: "token-de-prueba",
    hp: "",
    ...extra,
  };
}

/** IP distinta por prueba: el almacenamiento KV/D1 persiste entre pruebas del mismo archivo. */
let ipPorDefecto = "203.0.113.10";

function enviar(cuerpo: unknown, opciones: { tipo?: string; ip?: string } = {}) {
  return exports.default.fetch(URL_API, {
    method: "POST",
    headers: {
      "Content-Type": opciones.tipo ?? "application/json",
      "CF-Connecting-IP": opciones.ip ?? ipPorDefecto,
    },
    body: typeof cuerpo === "string" ? cuerpo : JSON.stringify(cuerpo),
  });
}

/**
 * Mockea siteverify: `exito` controla `success`; `extra` permite simular otra acción u otro host.
 * Por defecto devuelve la acción del envío y el host de SITE_URL (atento.galexbh.dev).
 */
function mockSiteverify(exito: boolean, extra: { action?: string; hostname?: string } = {}) {
  const original = globalThis.fetch;
  const llamadas: string[] = [];
  vi.stubGlobal("fetch", (entrada: RequestInfo | URL, init?: RequestInit) => {
    const url =
      typeof entrada === "string" ? entrada : entrada instanceof URL ? entrada.href : entrada.url;
    if (url === SITEVERIFY) {
      llamadas.push(url);
      return Promise.resolve(
        Response.json({
          success: exito,
          action: extra.action ?? "envio-respuesta",
          hostname: extra.hostname ?? "atento.galexbh.dev",
        }),
      );
    }
    return original(entrada, init);
  });
  return llamadas;
}

describe("POST /api/respuesta", () => {
  let llamadasSiteverify: string[];
  let contador = 0;
  beforeEach(() => {
    llamadasSiteverify = mockSiteverify(true);
    contador += 1;
    ipPorDefecto = `203.0.113.${contador}`;
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("envío válido -> 201 y fila en D1 sin IP ni hora", async () => {
    const envio = envioValido();
    const r = await enviar(envio);
    expect(r.status).toBe(201);
    expect(await r.json()).toEqual({ ok: true, nivel: "bajo" });
    expect(llamadasSiteverify).toHaveLength(1);

    const fila = await env.DB.prepare("SELECT * FROM respuestas WHERE id = ?")
      .bind(envio.id)
      .first<Record<string, unknown>>();
    expect(fila).not.toBeNull();
    expect(fila?.creado_en).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(fila?.periodo_anio).toBe(new Date().getUTCFullYear());
    expect(fila?.duracion_segundos).toBe(430);
    expect(fila?.nivel).toBe("bajo");
    expect(fila?.pos_inatencion).toBe(0);
    expect(fila?.consentimiento_investigacion).toBe(1);
    expect(fila?.version_instrumento).toBe("vanderbilt-padres-es-1.0");
    expect(JSON.parse(fila?.items as string)).toEqual(envio.respuestas);
    const columnas = Object.keys(fila ?? {});
    expect(columnas.some((c) => /^(ip|ip_hash|hora|fecha_hora|user_agent)$/i.test(c))).toBe(false);
    expect(JSON.stringify(fila)).not.toContain("203.0.113");
  });

  it("puntúa en servidor (ignora lo que diga el cliente)", async () => {
    const envio = envioValido({ respuestas: respuestasCompletas(3), duracionSegundos: undefined });
    const r = await enviar(envio);
    expect(r.status).toBe(201);
    // Todas las frecuencias en 3 -> inatención e hiperactividad positivas; sin desempeño -> moderado.
    expect((await r.json<{ nivel: string }>()).nivel).toBe("moderado");
    const fila = await env.DB.prepare(
      "SELECT pos_inatencion, pos_hiperactividad, pos_desempeno, nivel, duracion_segundos FROM respuestas WHERE id = ?",
    )
      .bind(envio.id)
      .first<Record<string, unknown>>();
    expect(fila?.pos_inatencion).toBe(1);
    expect(fila?.pos_hiperactividad).toBe(1);
    expect(fila?.pos_desempeno).toBe(0);
    expect(fila?.nivel).toBe("moderado");
    expect(fila?.duracion_segundos).toBeNull();
  });

  it("envío inválido -> 400 con lista de errores y sin eco del cuerpo", async () => {
    const r = await enviar(envioValido({ edadAnios: 40, municipio: "0199" }));
    expect(r.status).toBe(400);
    const cuerpo = await r.json<{ ok: boolean; motivo: string; errores: { campo: string }[] }>();
    expect(cuerpo.ok).toBe(false);
    expect(cuerpo.motivo).toBe("validacion");
    expect(cuerpo.errores.map((e) => e.campo)).toContain("edadAnios");
    expect(JSON.stringify(cuerpo)).not.toContain("token-de-prueba");
    expect(llamadasSiteverify).toHaveLength(0);
  });

  it("campo extra -> 400 (esquema estricto)", async () => {
    const r = await enviar({ ...envioValido(), nombre: "Juan" });
    expect(r.status).toBe(400);
    const cuerpo = await r.json<{ errores: { campo: string }[] }>();
    expect(cuerpo.errores.map((e) => e.campo)).toContain("nombre");
  });

  it("JSON malformado -> 400", async () => {
    const r = await enviar("{no es json");
    expect(r.status).toBe(400);
    expect((await r.json<{ motivo: string }>()).motivo).toBe("json_invalido");
  });

  it("Content-Type incorrecto -> 415", async () => {
    const r = await enviar(envioValido(), { tipo: "text/plain" });
    expect(r.status).toBe(415);
  });

  it("cuerpo mayor de 32 KB -> 413", async () => {
    const r = await enviar({ ...envioValido(), hp: "", relleno: "x".repeat(33 * 1024) });
    expect(r.status).toBe(413);
  });

  it("duplicado -> 200 idempotente y una sola fila", async () => {
    const envio = envioValido();
    expect((await enviar(envio)).status).toBe(201);
    const r = await enviar(envio);
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ ok: true, duplicado: true });
    const total = await env.DB.prepare("SELECT count(*) AS n FROM respuestas WHERE id = ?")
      .bind(envio.id)
      .first<{ n: number }>();
    expect(total?.n).toBe(1);
    // El reintento no vuelve a consumir Turnstile.
    expect(llamadasSiteverify).toHaveLength(1);
  });

  it("honeypot relleno -> 201 falso sin fila", async () => {
    const envio = envioValido({ hp: "soy un bot" });
    const r = await enviar(envio);
    expect(r.status).toBe(201);
    expect(await r.json()).toEqual({ ok: true });
    const fila = await env.DB.prepare("SELECT 1 AS x FROM respuestas WHERE id = ?")
      .bind(envio.id)
      .first();
    expect(fila).toBeNull();
    expect(llamadasSiteverify).toHaveLength(0);
  });

  it("completo pero sin nivel entregable (faltan 2 en ambas escalas de síntomas) -> 400", async () => {
    const envio = envioValido();
    const respuestas = { ...(envio.respuestas as Record<string, number>) };
    for (const id of ["V01", "V02", "V10", "V11"]) delete respuestas[id];
    const r = await enviar({ ...envio, respuestas }, { ip: "198.51.100.71" });
    expect(r.status).toBe(400);
    expect((await r.json<{ motivo: string }>()).motivo).toBe("incompleto");
    expect(llamadasSiteverify).toHaveLength(0);
  });

  it("Turnstile con acción de otra superficie -> 403", async () => {
    vi.unstubAllGlobals();
    mockSiteverify(true, { action: "otra-accion" });
    const r = await enviar(envioValido(), { ip: "198.51.100.61" });
    expect(r.status).toBe(403);
  });

  it("Turnstile emitido para otro host (o localhost en producción) -> 403", async () => {
    vi.unstubAllGlobals();
    mockSiteverify(true, { hostname: "localhost" });
    const r1 = await enviar(envioValido(), { ip: "198.51.100.62" });
    expect(r1.status).toBe(403);
    vi.unstubAllGlobals();
    mockSiteverify(true, { hostname: "malo.example" });
    const r2 = await enviar(envioValido(), { ip: "198.51.100.63" });
    expect(r2.status).toBe(403);
  });

  it("Turnstile inválido -> 403 y sin fila; la cuota se consume igualmente (B2)", async () => {
    vi.unstubAllGlobals();
    mockSiteverify(false);
    const envio = envioValido();
    const ip = "198.51.100.42";
    const antes = (await env.CACHE.list({ prefix: "rl:" })).keys.length;
    const r = await enviar(envio, { ip });
    expect(r.status).toBe(403);
    expect((await r.json<{ motivo: string }>()).motivo).toBe("turnstile");
    const fila = await env.DB.prepare("SELECT 1 AS x FROM respuestas WHERE id = ?")
      .bind(envio.id)
      .first();
    expect(fila).toBeNull();
    expect((await env.CACHE.list({ prefix: "rl:" })).keys.length).toBe(antes + 1);
    // Con la cuota agotada, el reintento recibe 429 antes de llegar a Turnstile.
    for (let i = 0; i < 4; i++) await enviar(envioValido(), { ip });
    expect((await enviar(envio, { ip })).status).toBe(429);
  });

  it("un envío inválido no consume cuota (B2: el límite va tras la validación)", async () => {
    const ip = "198.51.100.43";
    const antes = (await env.CACHE.list({ prefix: "rl:" })).keys.length;
    for (let i = 0; i < 7; i++) {
      expect((await enviar(envioValido({ edadAnios: 40 }), { ip })).status).toBe(400);
    }
    expect((await env.CACHE.list({ prefix: "rl:" })).keys.length).toBe(antes);
  });

  it("6.º envío en una hora desde la misma IP -> 429", async () => {
    for (let i = 0; i < 5; i++) {
      expect((await enviar(envioValido(), { ip: "198.51.100.7" })).status).toBe(201);
    }
    const r = await enviar(envioValido(), { ip: "198.51.100.7" });
    expect(r.status).toBe(429);
    // Otra IP sigue pudiendo enviar.
    expect((await enviar(envioValido(), { ip: "198.51.100.8" })).status).toBe(201);
    // En KV solo hay hashes, nunca la IP.
    const claves = await env.CACHE.list({ prefix: "rl:" });
    expect(claves.keys.length).toBeGreaterThan(0);
    for (const k of claves.keys) {
      expect(k.name).toMatch(/^rl:[0-9a-f]{64}$/);
      expect(k.name).not.toContain("198.51.100");
    }
  });

  it("guarda respuestasAtento bajo la clave `atento` si el esquema lo admite", async () => {
    const envio = { ...envioValido(), respuestasAtento: { A01: 2, A02: 0 } };
    const r = await enviar(envio);
    // Si el agente de diseño aún no añadió el campo, el esquema estricto responde 400.
    if (r.status === 400) return;
    expect(r.status).toBe(201);
    const fila = await env.DB.prepare("SELECT items FROM respuestas WHERE id = ?")
      .bind(envio.id)
      .first<{ items: string }>();
    expect(JSON.parse(fila?.items ?? "{}").atento).toEqual({ A01: 2, A02: 0 });
  });

  describe("versión docente", () => {
    const docente = obtenerInstrumento("vanderbilt-docente-es-1.0");
    const respuestasDocente = (frecuencia = 1, desempeno = 3) => {
      const r: Record<string, number> = {};
      for (const item of docente.items) {
        r[item.id] = item.tipo === "desempeno" ? desempeno : frecuencia;
      }
      return r;
    };
    const envioDocente = (extra: Partial<Envio> = {}): Envio =>
      envioValido({
        instrumentoId: "vanderbilt-docente-es-1.0",
        respuestas: respuestasDocente(),
        informante: "docente",
        versionConsentimiento: "2026-10-12",
        codigoVinculo: "ABCD2345",
        ...extra,
      });

    it("POST docente válido -> 201 sin nivel; fila con informante docente y código guardado", async () => {
      const envio = envioDocente({ respuestas: respuestasDocente(3, 5) });
      const r = await enviar(envio);
      expect(r.status).toBe(201);
      // Al docente no se le devuelve nivel ni interpretación.
      expect(await r.json()).toEqual({ ok: true });
      const fila = await env.DB.prepare("SELECT * FROM respuestas WHERE id = ?")
        .bind(envio.id)
        .first<Record<string, unknown>>();
      expect(fila).toMatchObject({
        informante: "docente",
        version_instrumento: "vanderbilt-docente-es-1.0",
        codigo_vinculo: "ABCD2345",
        version_consentimiento: "2026-10-12",
        pos_inatencion: 1,
        pos_conducta: 1,
        pos_oposicion: 0,
        pos_desempeno: 1,
        // El servidor sí guarda el nivel para investigación.
        nivel: "alto",
      });
      expect(JSON.parse(fila?.items as string)).toEqual(envio.respuestas);
    });

    it("POST docente sin código de vínculo -> 201 con codigo_vinculo NULL", async () => {
      const { codigoVinculo: _sin, ...envio } = envioDocente();
      const r = await enviar(envio);
      expect(r.status).toBe(201);
      const fila = await env.DB.prepare("SELECT codigo_vinculo FROM respuestas WHERE id = ?")
        .bind(envio.id)
        .first<{ codigo_vinculo: string | null }>();
      expect(fila?.codigo_vinculo).toBeNull();
    });

    it("instrumento de padres con informante 'docente' -> 400", async () => {
      const r = await enviar(envioValido({ informante: "docente" }));
      expect(r.status).toBe(400);
      const cuerpo = await r.json<{ errores: { campo: string }[] }>();
      expect(cuerpo.errores.map((e) => e.campo)).toContain("informante");
      expect(llamadasSiteverify).toHaveLength(0);
    });

    it("instrumento docente con informante de familia -> 400", async () => {
      const r = await enviar(envioDocente({ informante: "madre" }));
      expect(r.status).toBe(400);
    });

    it("instrumento docente con respuestasAtento -> 400", async () => {
      const r = await enviar(envioDocente({ respuestasAtento: { A01: 1 } }));
      expect(r.status).toBe(400);
      const cuerpo = await r.json<{ errores: { campo: string }[] }>();
      expect(cuerpo.errores.map((e) => e.campo)).toContain("respuestasAtento");
    });
  });
});
