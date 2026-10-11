/**
 * Verificación de Cloudflare Turnstile.
 *
 * En local/preview sin `TURNSTILE_SECRET` (es decir, `ENTORNO !== "produccion"` y secreto vacío)
 * se asume la clave de prueba de Cloudflare (`1x0000000000000000000000000000000AA`, que acepta
 * cualquier token) y NO se llama a siteverify: equivale al comportamiento de esa clave y permite
 * trabajar sin red. En producción el secreto es obligatorio; si falta, toda verificación falla.
 */
const URL_SITEVERIFY = "https://challenges.cloudflare.com/turnstile/v0/siteverify";
const TIMEOUT_MS = 5000;

export interface OpcionesTurnstile {
  secreto: string | undefined;
  entorno: string | undefined;
  token: string;
  ip?: string;
}

export async function verificarTurnstile(opciones: OpcionesTurnstile): Promise<boolean> {
  const secreto = opciones.secreto ?? "";
  if (secreto === "") {
    if (opciones.entorno !== "produccion") return opciones.token.length > 0;
    return false;
  }
  const cuerpo = new URLSearchParams({ secret: secreto, response: opciones.token });
  if (opciones.ip && opciones.ip !== "sin-ip") cuerpo.set("remoteip", opciones.ip);
  try {
    const respuesta = await fetch(URL_SITEVERIFY, {
      method: "POST",
      body: cuerpo,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!respuesta.ok) return false;
    const datos = (await respuesta.json()) as { success?: boolean };
    return datos.success === true;
  } catch {
    return false;
  }
}
