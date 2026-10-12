import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import { exigeOrigenEstricto, verificarOrigen } from "@/lib/api/origen";

/**
 * M1 (anti-CSRF) dentro de workerd, con el SITE_URL y ENTORNO reales de wrangler.jsonc
 * (producción). El middleware de Astro aplica `verificarOrigen` a todo POST bajo /admin y
 * /api/admin (ver src/middleware.ts); aquí se prueba esa decisión con peticiones reales.
 */
function decidir(request: Request) {
  const url = new URL(request.url);
  if (!exigeOrigenEstricto(url.pathname, request.method)) return { permitido: true as const };
  return verificarOrigen(request.headers, {
    siteUrl: env.SITE_URL,
    entorno: env.ENTORNO,
    origenPeticion: url.origin,
  });
}

describe("POST bajo /admin y /api/admin exige origen propio", () => {
  const BASE = env.SITE_URL;

  it("acepta Origin del sitio o Sec-Fetch-Site same-origin", () => {
    const conOrigin = new Request(`${BASE}/admin/sistema`, {
      method: "POST",
      headers: { Origin: BASE },
    });
    expect(decidir(conOrigin).permitido).toBe(true);
    const sinOrigin = new Request(`${BASE}/api/admin/entrar`, {
      method: "POST",
      headers: { "Sec-Fetch-Site": "same-origin" },
    });
    expect(decidir(sinOrigin).permitido).toBe(true);
  });

  it("rechaza Origin ajeno, Sec-Fetch-Site cross-site y la ausencia de ambas en producción", () => {
    expect(env.ENTORNO).toBe("produccion");
    const ajeno = new Request(`${BASE}/admin/sistema`, {
      method: "POST",
      headers: { Origin: "https://atacante.example" },
    });
    expect(decidir(ajeno)).toEqual({ permitido: false, motivo: "origen no permitido" });
    const cruzado = new Request(`${BASE}/api/admin/sistema`, {
      method: "POST",
      headers: { "Sec-Fetch-Site": "cross-site" },
    });
    expect(decidir(cruzado).permitido).toBe(false);
    const sinNada = new Request(`${BASE}/admin/entrar`, { method: "POST" });
    expect(decidir(sinNada)).toEqual({ permitido: false, motivo: "falta la cabecera Origin" });
  });

  it("los GET del panel no se ven afectados", () => {
    const get = new Request(`${BASE}/admin/geografia`, { method: "GET" });
    expect(decidir(get).permitido).toBe(true);
  });
});
