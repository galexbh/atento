/**
 * Comprobación de origen (anti-CSRF) para peticiones que cambian estado.
 *
 * Reglas (ver middleware.ts):
 * - Si viene `Origin`, debe coincidir con SITE_URL (o con el propio origen en ENTORNO=local).
 * - `Origin: null` cuenta como ausente: con `Referrer-Policy: no-referrer` (que el middleware
 *   fija en todas las respuestas) Chrome envía `Origin: null` incluso en formularios del propio
 *   sitio, así que la decisión pasa a `Sec-Fetch-Site` (un iframe aislado de otro origen envía
 *   `cross-site` y se rechaza igualmente).
 * - Si no viene `Origin`, se usa `Sec-Fetch-Site`: `cross-site` se rechaza.
 * - Si faltan ambas cabeceras, en producción/preview se rechaza (los navegadores modernos siempre
 *   envían al menos una en POST); en local se acepta para poder usar curl.
 */
export interface OpcionesOrigen {
  siteUrl: string;
  entorno: string | undefined;
  /** Origen de la URL solicitada (para aceptar el propio origen en local). */
  origenPeticion: string;
}

export type ResultadoOrigen = { permitido: true } | { permitido: false; motivo: string };

export function verificarOrigen(headers: Headers, o: OpcionesOrigen): ResultadoOrigen {
  const origen = headers.get("Origin");
  if (origen !== null && origen !== "null") {
    let permitido = false;
    try {
      permitido = new URL(origen).origin === new URL(o.siteUrl).origin;
    } catch {
      permitido = false;
    }
    if (!permitido && o.entorno === "local") permitido = origen === o.origenPeticion;
    return permitido ? { permitido: true } : { permitido: false, motivo: "origen no permitido" };
  }
  const sitio = headers.get("Sec-Fetch-Site");
  if (sitio !== null) {
    return sitio === "cross-site"
      ? { permitido: false, motivo: "origen no permitido" }
      : { permitido: true };
  }
  if (o.entorno === "local") return { permitido: true };
  return { permitido: false, motivo: "falta la cabecera Origin" };
}

/**
 * Rutas en las que se comprueba el origen: todo /api/* (si envía Origin) y cualquier método
 * distinto de GET/HEAD/OPTIONS bajo /admin y /api/admin (siempre, con las reglas de arriba).
 */
export function exigeOrigenEstricto(pathname: string, method: string): boolean {
  const mutador = method !== "GET" && method !== "HEAD" && method !== "OPTIONS";
  if (!mutador) return false;
  return (
    pathname === "/admin" ||
    pathname.startsWith("/admin/") ||
    pathname === "/api/admin" ||
    pathname.startsWith("/api/admin/")
  );
}
