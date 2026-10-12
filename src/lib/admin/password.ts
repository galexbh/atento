/**
 * Modo de respaldo sin Cloudflare Access: contraseña única (PBKDF2-SHA256, 100k iteraciones,
 * con sal) y cookie de sesión firmada con HMAC-SHA256. Límite de intentos por hash de IP en KV.
 *
 * Nota: workerd en Cloudflare rechaza PBKDF2 con más de 100 000 iteraciones
 * (`NotSupportedError: iteration counts above 100000 are not supported`), por eso el máximo es
 * 100 000 y `verificarContrasena` rechaza hashes que lo superen.
 */
import { base64UrlCodificar, base64UrlDecodificar, type Rol } from "./acceso";

export const ITERACIONES_PBKDF2 = 100_000;
/** Límite impuesto por el runtime de Cloudflare Workers. */
export const MAX_ITERACIONES_PBKDF2 = 100_000;
export const MIN_ITERACIONES_PBKDF2 = 10_000;
export const NOMBRE_COOKIE = "atento_admin";
export const DURACION_SESION_SEG = 8 * 60 * 60;
export const MAX_INTENTOS = 5;
export const VENTANA_INTENTOS_SEG = 15 * 60;

const codificador = new TextEncoder();

async function derivar(
  contrasena: string,
  sal: Uint8Array,
  iteraciones: number,
): Promise<Uint8Array> {
  const material = await crypto.subtle.importKey(
    "raw",
    codificador.encode(contrasena),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: sal as BufferSource, iterations: iteraciones },
    material,
    256,
  );
  return new Uint8Array(bits);
}

/** Genera `pbkdf2$<iteraciones>$<sal b64url>$<hash b64url>`. */
export async function generarHash(contrasena: string): Promise<string> {
  const sal = new Uint8Array(16);
  crypto.getRandomValues(sal);
  const hash = await derivar(contrasena, sal, ITERACIONES_PBKDF2);
  return `pbkdf2$${ITERACIONES_PBKDF2}$${base64UrlCodificar(sal)}$${base64UrlCodificar(hash)}`;
}

function igualesConstante(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let dif = 0;
  for (let i = 0; i < a.length; i++) dif |= (a[i] as number) ^ (b[i] as number);
  return dif === 0;
}

export async function verificarContrasena(
  contrasena: string,
  hashGuardado: string,
): Promise<boolean> {
  const partes = hashGuardado.split("$");
  if (partes.length !== 4 || partes[0] !== "pbkdf2") return false;
  const iteraciones = Number(partes[1]);
  if (!Number.isInteger(iteraciones) || iteraciones < MIN_ITERACIONES_PBKDF2) return false;
  if (iteraciones > MAX_ITERACIONES_PBKDF2) {
    console.error(
      `ADMIN_PASSWORD_HASH usa ${iteraciones} iteraciones; Cloudflare Workers admite como máximo ${MAX_ITERACIONES_PBKDF2}. Regenera el hash con scripts/hash-password.ts.`,
    );
    return false;
  }
  try {
    const sal = base64UrlDecodificar(partes[2] as string);
    const esperado = base64UrlDecodificar(partes[3] as string);
    const calculado = await derivar(contrasena, sal, iteraciones);
    return igualesConstante(calculado, esperado);
  } catch {
    return false;
  }
}

async function claveHmac(secreto: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    codificador.encode(secreto),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

export interface Sesion {
  u: string;
  r: Rol;
  /** Emitida en (segundos Unix); permite invalidar todas las sesiones anteriores a una fecha. */
  iat: number;
  exp: number;
}

/** Crea el valor firmado de la cookie: `<payload b64url>.<hmac b64url>`. */
export async function crearSesion(
  secreto: string,
  usuario: string,
  rol: Rol,
  ahora = Date.now(),
): Promise<string> {
  const iat = Math.floor(ahora / 1000);
  const sesion: Sesion = { u: usuario, r: rol, iat, exp: iat + DURACION_SESION_SEG };
  const payload = base64UrlCodificar(codificador.encode(JSON.stringify(sesion)));
  const firma = await crypto.subtle.sign(
    "HMAC",
    await claveHmac(secreto),
    codificador.encode(payload),
  );
  return `${payload}.${base64UrlCodificar(new Uint8Array(firma))}`;
}

/**
 * Verifica la cookie. `noAntesDe` (segundos Unix, de `configuracion.sesiones_no_antes_de`)
 * invalida las sesiones emitidas antes de ese instante ("cerrar todas las sesiones").
 */
export async function verificarSesion(
  secreto: string,
  valor: string,
  ahora = Date.now(),
  noAntesDe = 0,
): Promise<Sesion | null> {
  const [payload, firma] = valor.split(".");
  if (!payload || !firma) return null;
  let valida = false;
  try {
    valida = await crypto.subtle.verify(
      "HMAC",
      await claveHmac(secreto),
      base64UrlDecodificar(firma) as BufferSource,
      codificador.encode(payload),
    );
  } catch {
    return null;
  }
  if (!valida) return null;
  try {
    const sesion = JSON.parse(new TextDecoder().decode(base64UrlDecodificar(payload))) as Sesion;
    if (typeof sesion.u !== "string" || (sesion.r !== "admin" && sesion.r !== "investigador"))
      return null;
    if (typeof sesion.exp !== "number" || sesion.exp * 1000 <= ahora) return null;
    if (typeof sesion.iat !== "number" || sesion.iat > ahora / 1000 + 60) return null;
    if (sesion.iat < noAntesDe) return null;
    return sesion;
  } catch {
    return null;
  }
}

export function leerCookie(request: Request, nombre: string): string | null {
  const cookie = request.headers.get("Cookie") ?? "";
  for (const parte of cookie.split(";")) {
    const [k, ...resto] = parte.trim().split("=");
    if (k === nombre) return resto.join("=");
  }
  return null;
}

export function cabeceraCookieSesion(valor: string, segura: boolean): string {
  const atributos = [
    `${NOMBRE_COOKIE}=${valor}`,
    "HttpOnly",
    "SameSite=Strict",
    // Path=/ para que /api/admin/* también reciba la cookie; SameSite=Strict la protege del CSRF.
    "Path=/",
    `Max-Age=${DURACION_SESION_SEG}`,
  ];
  if (segura) atributos.push("Secure");
  return atributos.join("; ");
}

export function cabeceraBorrarCookie(segura: boolean): string {
  const atributos = [`${NOMBRE_COOKIE}=`, "HttpOnly", "SameSite=Strict", "Path=/", "Max-Age=0"];
  if (segura) atributos.push("Secure");
  return atributos.join("; ");
}

/** HMAC-SHA256(ip) con la sal (RATE_SALT o, si falta, ADMIN_SESSION_SECRET): sin sal predecible. */
export async function hashIp(ip: string, sal: string): Promise<string> {
  const clave = await crypto.subtle.importKey(
    "raw",
    codificador.encode(sal),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const digesto = await crypto.subtle.sign("HMAC", clave, codificador.encode(ip));
  return base64UrlCodificar(new Uint8Array(digesto)).slice(0, 32);
}

export function ipDePeticion(request: Request): string {
  return (
    request.headers.get("CF-Connecting-IP") ??
    request.headers.get("X-Forwarded-For") ??
    "desconocida"
  );
}

/** Verdadero si la IP superó el máximo de intentos en la ventana. */
export async function estaBloqueada(kv: KVNamespace, ip: string, sal: string): Promise<boolean> {
  const clave = `admin:intentos:${await hashIp(ip, sal)}`;
  const valor = await kv.get(clave);
  return Number(valor ?? 0) >= MAX_INTENTOS;
}

export async function registrarIntentoFallido(
  kv: KVNamespace,
  ip: string,
  sal: string,
): Promise<number> {
  const clave = `admin:intentos:${await hashIp(ip, sal)}`;
  const actual = Number((await kv.get(clave)) ?? 0) + 1;
  await kv.put(clave, String(actual), { expirationTtl: VENTANA_INTENTOS_SEG });
  return actual;
}

export async function limpiarIntentos(kv: KVNamespace, ip: string, sal: string): Promise<void> {
  await kv.delete(`admin:intentos:${await hashIp(ip, sal)}`);
}
