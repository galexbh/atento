import { defineMiddleware } from "astro:middleware";
import { env } from "cloudflare:workers";

/**
 * Middleware global de Atento.
 *
 * 1. Cabeceras de seguridad en TODAS las respuestas (CSP con nonce por petición).
 * 2. Verificación de `Origin` en /api/* (debe coincidir con SITE_URL si viene).
 * 3. Modo mantenimiento (configuracion.mantenimiento = '1') -> 503, salvo /admin*.
 *
 * Nota sobre `style-src 'unsafe-inline'`: Astro inyecta los estilos de componentes como
 * `<style>` inline (y `astro:transitions`/islas añaden atributos `style`). Hasta que se adopte
 * `security.csp` de Astro con hashes, se permite inline SOLO para estilos; los scripts siguen
 * exigiendo nonce.
 */

const HOSTS_HSTS = new Set(["atento.galexbh.dev", "atento-preview.galexbh.dev"]);
const TTL_MANTENIMIENTO_MS = 60_000;

let cacheMantenimiento: { valor: boolean; expira: number } = { valor: false, expira: 0 };

function generarNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  let binario = "";
  for (const b of bytes) binario += String.fromCharCode(b);
  return btoa(binario);
}

function construirCsp(nonce: string): string {
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' https://challenges.cloudflare.com`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data:",
    "font-src 'self'",
    "connect-src 'self'",
    "frame-src https://challenges.cloudflare.com",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join("; ");
}

function aplicarCabecerasSeguridad(respuesta: Response, nonce: string, host: string): Response {
  const h = respuesta.headers;
  h.set("Content-Security-Policy", construirCsp(nonce));
  h.set("X-Content-Type-Options", "nosniff");
  h.set("Referrer-Policy", "no-referrer");
  h.set("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=()");
  h.set("X-Frame-Options", "DENY");
  h.set("Cross-Origin-Opener-Policy", "same-origin");
  if (HOSTS_HSTS.has(host)) {
    h.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  }
  return respuesta;
}

async function estaEnMantenimiento(): Promise<boolean> {
  const ahora = Date.now();
  if (ahora < cacheMantenimiento.expira) return cacheMantenimiento.valor;
  let valor = false;
  try {
    const fila = await env.DB.prepare(
      "SELECT valor FROM configuracion WHERE clave = 'mantenimiento'",
    ).first<{ valor: string | null }>();
    valor = fila?.valor === "1";
  } catch {
    // Sin D1 (p. ej. esquema no migrado): se asume operación normal.
    valor = false;
  }
  cacheMantenimiento = { valor, expira: ahora + TTL_MANTENIMIENTO_MS };
  return valor;
}

function paginaMantenimiento(): Response {
  const html = `<!doctype html>
<html lang="es-HN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Atento — en mantenimiento</title>
<style>body{font-family:system-ui,sans-serif;max-width:40rem;margin:4rem auto;padding:0 1rem;color:#1f2933;background:#fff}</style>
</head>
<body>
<h1>Atento está en mantenimiento</h1>
<p>Volvemos en unos minutos. Si necesitas apoyo, escribe a <a href="mailto:info@galexbh.dev">info@galexbh.dev</a>.</p>
</body>
</html>`;
  return new Response(html, {
    status: 503,
    headers: { "Content-Type": "text/html; charset=utf-8", "Retry-After": "300" },
  });
}

function respuestaJson(cuerpo: unknown, status: number): Response {
  return new Response(JSON.stringify(cuerpo), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}

export const onRequest = defineMiddleware(async (context, next) => {
  const url = new URL(context.request.url);
  const nonce = generarNonce();
  context.locals.nonce = nonce;

  // /api/*: si el navegador envía Origin, debe ser el del sitio.
  if (url.pathname.startsWith("/api/")) {
    const origen = context.request.headers.get("Origin");
    if (origen !== null) {
      let permitido = false;
      try {
        permitido = new URL(origen).origin === new URL(env.SITE_URL).origin;
      } catch {
        permitido = false;
      }
      // En local el sitio corre en localhost; se acepta el propio origen de la petición.
      if (!permitido && env.ENTORNO === "local") permitido = origen === url.origin;
      if (!permitido) {
        return aplicarCabecerasSeguridad(
          respuestaJson({ error: "origen no permitido" }, 403),
          nonce,
          url.hostname,
        );
      }
    }
  }

  if (!url.pathname.startsWith("/admin") && (await estaEnMantenimiento())) {
    return aplicarCabecerasSeguridad(paginaMantenimiento(), nonce, url.hostname);
  }

  const respuesta = await next();
  return aplicarCabecerasSeguridad(respuesta, nonce, url.hostname);
});
