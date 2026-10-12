import { env } from "cloudflare:workers";
import type { APIRoute } from "astro";
import { respuestaCacheable } from "@/lib/api/cache";
import { error, registrar } from "@/lib/api/http";
import { listarAniosPublicadosJson } from "@/lib/publico/publicar";

export const prerender = false;

/** GET /api/publico/anios — años publicables: {anios:[{anio, version, preliminar, generadoEn}]}. */
export const GET: APIRoute = async ({ request }) => {
  const inicio = Date.now();
  try {
    const { cuerpo, desdeCache } = await listarAniosPublicadosJson(env);
    const r = await respuestaCacheable(request, cuerpo);
    r.headers.set("X-Cache", desdeCache ? "HIT" : "MISS");
    registrar("publico_anios", r.status, inicio);
    return r;
  } catch {
    registrar("publico_anios", 503, inicio);
    return error(503, "no_disponible");
  }
};
