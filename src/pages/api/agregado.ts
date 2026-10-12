import { env } from "cloudflare:workers";
import type { APIRoute } from "astro";
import { consultarAgregadoConCache, EsquemaConsultaAgregado } from "@/lib/agregados/consultar";
import { respuestaCacheable } from "@/lib/api/cache";
import { error, formatearErrores, registrar } from "@/lib/api/http";

export const prerender = false;

/**
 * GET /api/agregado?periodo=2026&nivel=departamento|municipio&version=todas
 *
 * Endurecido: solo `periodo` = año calendario (meses, trimestres y "acumulado" -> 400) y solo
 * `version=todas`. Delega en la publicación segura anual (supresión primaria y complementaria,
 * ver src/lib/publico/datos.ts); las celdas suprimidas llevan `n: null`. Caché KV 1 h,
 * `Cache-Control: public, max-age=300, s-maxage=3600` y ETag (304 con If-None-Match).
 * Respuesta: {periodo, nivel, version, versionDataset, preliminar, calculadoEn, datos:[...]}.
 * Para datos nuevos, preferir `/api/publico/datos`.
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
