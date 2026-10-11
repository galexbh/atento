import { env, exports } from "cloudflare:workers";
import { describe, expect, it } from "vitest";

describe("humo: runtime de Workers", () => {
  it("GET /api/salud responde ok", async () => {
    const respuesta = await exports.default.fetch("https://atento.galexbh.dev/api/salud");
    expect(respuesta.status).toBe(200);
    const cuerpo = await respuesta.json<{ ok: boolean; entorno: string; version: string }>();
    expect(cuerpo.ok).toBe(true);
    expect(cuerpo.entorno).toBe("produccion");
    expect(cuerpo.version).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it("las migraciones D1 crearon el esquema", async () => {
    const fila = await env.DB.prepare(
      "SELECT valor FROM configuracion WHERE clave = 'mantenimiento'",
    ).first<{ valor: string }>();
    expect(fila?.valor).toBe("0");
    const tablas = await env.DB.prepare(
      "SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name",
    ).all<{ name: string }>();
    const nombres = tablas.results.map((t) => t.name);
    for (const esperada of [
      "respuestas",
      "agregados_municipio",
      "agregados_anuales",
      "agregados_psicometria",
      "auditoria_admin",
      "configuracion",
    ]) {
      expect(nombres).toContain(esperada);
    }
  });
});
