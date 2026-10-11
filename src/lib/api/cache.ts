/**
 * Caché KV de respuestas públicas de agregados.
 * Claves `agregado:*`; TTL 1 h. El cron las invalida al terminar de recalcular.
 */
export const PREFIJO_CACHE_AGREGADOS = "agregado:";
export const TTL_CACHE_AGREGADOS_S = 3600;
export const CACHE_CONTROL_AGREGADOS = "public, max-age=300, s-maxage=3600";

export function claveCacheAgregado(partes: string[]): string {
  return PREFIJO_CACHE_AGREGADOS + partes.join(":");
}

/** Borra todas las claves `agregado:*` (paginando el listado). */
export async function invalidarCacheAgregados(kv: KVNamespace): Promise<number> {
  let borradas = 0;
  let cursor: string | undefined;
  do {
    const pagina = await kv.list({ prefix: PREFIJO_CACHE_AGREGADOS, cursor });
    await Promise.all(pagina.keys.map((k) => kv.delete(k.name)));
    borradas += pagina.keys.length;
    cursor = pagina.list_complete ? undefined : pagina.cursor;
  } while (cursor);
  return borradas;
}

/** ETag fuerte a partir del cuerpo (SHA-256 truncado a 128 bits). */
export async function calcularEtag(cuerpo: string): Promise<string> {
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(cuerpo));
  const hex = [...new Uint8Array(hash).slice(0, 16)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `"${hex}"`;
}

/**
 * Responde un cuerpo cacheable con ETag; devuelve 304 si `If-None-Match` coincide.
 * `cuerpo` ya debe estar serializado (es lo mismo que se guarda en KV).
 */
export async function respuestaCacheable(
  request: Request,
  cuerpo: string,
  opciones: { cacheControl?: string; tipo?: string } = {},
): Promise<Response> {
  const etag = await calcularEtag(cuerpo);
  const cabeceras: Record<string, string> = {
    "Content-Type": opciones.tipo ?? "application/json; charset=utf-8",
    "Cache-Control": opciones.cacheControl ?? CACHE_CONTROL_AGREGADOS,
    ETag: etag,
    Vary: "Accept-Encoding",
  };
  const ifNoneMatch = request.headers.get("If-None-Match");
  if (ifNoneMatch?.split(",").some((v) => v.trim().replace(/^W\//, "") === etag)) {
    return new Response(null, { status: 304, headers: cabeceras });
  }
  return new Response(cuerpo, { status: 200, headers: cabeceras });
}
