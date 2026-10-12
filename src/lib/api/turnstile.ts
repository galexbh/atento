/**
 * Verificación de Cloudflare Turnstile.
 *
 * Solo en `ENTORNO = "local"` (o "test") se admite trabajar sin secreto o con la clave de prueba de
 * Cloudflare (`1x0000000000000000000000000000000AA`, que acepta cualquier token): en ese caso NO se
 * llama a siteverify y basta con que el token no esté vacío. En preview y producción el secreto
 * real es obligatorio: si falta o es una clave de prueba, toda verificación falla (fail-closed).
 */
const URL_SITEVERIFY = "https://challenges.cloudflare.com/turnstile/v0/siteverify";
const TIMEOUT_MS = 5000;
const CLAVES_DE_PRUEBA = new Set([
  "1x0000000000000000000000000000000AA",
  "2x0000000000000000000000000000000AA",
  "3x0000000000000000000000000000000AA",
]);

export interface OpcionesTurnstile {
  secreto: string | undefined;
  entorno: string | undefined;
  token: string;
  ip?: string;
}

export function esEntornoDeDesarrollo(entorno: string | undefined): boolean {
  return entorno === "local" || entorno === "test";
}

export async function verificarTurnstile(opciones: OpcionesTurnstile): Promise<boolean> {
  const secreto = opciones.secreto ?? "";
  if (secreto === "" || CLAVES_DE_PRUEBA.has(secreto)) {
    if (esEntornoDeDesarrollo(opciones.entorno)) return opciones.token.length > 0;
    console.error("turnstile: TURNSTILE_SECRET ausente o de prueba fuera de local; se rechaza");
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
