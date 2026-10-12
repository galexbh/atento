import { env } from "cloudflare:workers";
import type { APIRoute } from "astro";
import { listarPeriodos } from "@/lib/agregados/consultar";
import { respuestaCacheable } from "@/lib/api/cache";
import { error, registrar } from "@/lib/api/http";

export const prerender = false;

/** GET /api/agregado/periodos — años publicados (solo años; versión de instrumento "todas"). */
export const GET: APIRoute = async ({ request }) => {
  const inicio = Date.now();
  try {
    const { cuerpo, desdeCache } = await listarPeriodos(env);
    const r = await respuestaCacheable(request, cuerpo);
    r.headers.set("X-Cache", desdeCache ? "HIT" : "MISS");
    registrar("agregado_periodos", r.status, inicio);
    return r;
  } catch {
    registrar("agregado_periodos", 503, inicio);
    return error(503, "no_disponible");
  }
};
