import { env } from "cloudflare:workers";
import type { APIRoute } from "astro";
import { consultarAgregadoConCache, EsquemaConsultaAgregado } from "@/lib/agregados/consultar";
import { respuestaCacheable } from "@/lib/api/cache";
import { error, formatearErrores, registrar } from "@/lib/api/http";

export const prerender = false;

/**
 * GET /api/agregado?periodo=2026&nivel=departamento|municipio&version=todas
 *
 * Lee solo `agregados_municipio` (nunca respuestas individuales). Caché KV 1 h, cabeceras
 * `Cache-Control: public, max-age=300, s-maxage=3600` y ETag (304 con If-None-Match).
 * Respuesta: {periodo, nivel, version, calculadoEn, datos:[{codigo, nombre, n, pct, ic95, suprimido, ...}]}.
 */
export const GET: APIRoute = async ({ request }) => {
  const inicio = Date.now();
  const url = new URL(request.url);
  const validacion = EsquemaConsultaAgregado.safeParse(Object.fromEntries(url.searchParams));
  if (!validacion.success) {
    const errores = formatearErrores(validacion.error.issues);
    registrar("agregado", 400, inicio);
    return error(400, "parametros", { errores });
  }
  try {
    const { cuerpo, desdeCache } = await consultarAgregadoConCache(env, validacion.data);
    const r = await respuestaCacheable(request, cuerpo);
    r.headers.set("X-Cache", desdeCache ? "HIT" : "MISS");
    registrar("agregado", r.status, inicio);
    return r;
  } catch {
    registrar("agregado", 503, inicio);
    return error(503, "no_disponible");
  }
};
