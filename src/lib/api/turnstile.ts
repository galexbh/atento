/**
 * Verificación de Cloudflare Turnstile.
 *
 * Solo en `ENTORNO = "local"` (o "test") se admite trabajar sin secreto o con la clave de prueba de
 * Cloudflare (`1x0000000000000000000000000000000AA`, que acepta cualquier token): en ese caso NO se
 * llama a siteverify y basta con que el token no esté vacío. En preview y producción el secreto
 * real es obligatorio: si falta o es una clave de prueba, toda verificación falla (fail-closed).
 *
 * Con secreto real se exige, además de `success === true`, que `action` coincida con la acción de
 * la superficie y que `hostname` esté en la lista de hosts del despliegue. `localhost` y
 * `127.0.0.1` solo se aceptan en desarrollo.
 */
import { ACCION_ENVIO, LONGITUD_MAXIMA_TOKEN } from "@/lib/compartido/turnstile";

const URL_SITEVERIFY = "https://challenges.cloudflare.com/turnstile/v0/siteverify";
const TIMEOUT_MS = 10_000;
const CLAVES_DE_PRUEBA = new Set([
  "1x0000000000000000000000000000000AA",
  "2x0000000000000000000000000000000AA",
  "3x0000000000000000000000000000000AA",
]);
const HOSTS_DESARROLLO = ["localhost", "127.0.0.1"];

export interface OpcionesTurnstile {
  secreto: string | undefined;
  entorno: string | undefined;
  token: string;
  ip?: string;
  /** URL pública del despliegue (`SITE_URL`); su host es el único aceptado fuera de local. */
  sitio?: string;
  /** Acción esperada; por defecto la del envío del cuestionario. */
  accion?: string;
}

interface RespuestaSiteverify {
  success?: boolean;
  action?: string;
  hostname?: string;
  "error-codes"?: string[];
}

export function esEntornoDeDesarrollo(entorno: string | undefined): boolean {
  return entorno === "local" || entorno === "test";
}

/** Hosts aceptados para `hostname` según el entorno. */
export function hostsPermitidos(sitio: string | undefined, entorno: string | undefined): string[] {
  const hosts: string[] = [];
  if (sitio) {
    try {
      hosts.push(new URL(sitio).hostname);
    } catch {
      // SITE_URL mal formado: sin host de despliegue, solo cabrían los de desarrollo.
    }
  }
  if (esEntornoDeDesarrollo(entorno)) hosts.push(...HOSTS_DESARROLLO);
  return hosts;
}

export function tokenConFormaValida(token: string): boolean {
  return typeof token === "string" && token.length > 0 && token.length <= LONGITUD_MAXIMA_TOKEN;
}

export async function verificarTurnstile(opciones: OpcionesTurnstile): Promise<boolean> {
  if (!tokenConFormaValida(opciones.token)) return false;
  const secreto = opciones.secreto ?? "";
  if (secreto === "" || CLAVES_DE_PRUEBA.has(secreto)) {
    if (esEntornoDeDesarrollo(opciones.entorno)) return true;
    console.error("turnstile: TURNSTILE_SECRET ausente o de prueba fuera de local; se rechaza");
    return false;
  }
  const cuerpo = new URLSearchParams({ secret: secreto, response: opciones.token });
  if (opciones.ip && opciones.ip !== "sin-ip") cuerpo.set("remoteip", opciones.ip);
  let datos: RespuestaSiteverify;
  try {
    const respuesta = await fetch(URL_SITEVERIFY, {
      method: "POST",
      body: cuerpo,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!respuesta.ok) return false;
    datos = (await respuesta.json()) as RespuestaSiteverify;
  } catch {
    return false;
  }
  if (datos.success !== true) return false;
  const accionEsperada = opciones.accion ?? ACCION_ENVIO;
  if (datos.action !== accionEsperada) {
    console.warn(JSON.stringify({ evento: "turnstile_accion", esperado: accionEsperada }));
    return false;
  }
  const hosts = hostsPermitidos(opciones.sitio, opciones.entorno);
  if (!datos.hostname || !hosts.includes(datos.hostname)) {
    console.warn(JSON.stringify({ evento: "turnstile_hostname" }));
    return false;
  }
  return true;
}
