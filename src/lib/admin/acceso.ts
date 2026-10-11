/**
 * Validación del JWT de Cloudflare Access (cabecera `Cf-Access-Jwt-Assertion` o cookie
 * `CF_Authorization`) contra el JWKS del equipo, con WebCrypto (RS256) y caché de 1 h.
 */

export type Rol = "admin" | "investigador";

export interface Usuario {
  email: string;
  rol: Rol;
  /** "access" o "password". */
  mecanismo: "access" | "password";
}

interface Jwk extends JsonWebKey {
  kid?: string;
}

interface Jwks {
  keys: Jwk[];
}

const TTL_JWKS_MS = 60 * 60 * 1000;
const cacheJwks = new Map<string, { claves: Jwk[]; expira: number }>();

export type ObtenerJwks = (url: string) => Promise<Jwks>;

const obtenerJwksPorDefecto: ObtenerJwks = async (url) => {
  const respuesta = await fetch(url, { headers: { Accept: "application/json" } });
  if (!respuesta.ok) throw new Error(`JWKS no disponible (${respuesta.status})`);
  return (await respuesta.json()) as Jwks;
};

export async function cargarJwks(
  teamDomain: string,
  obtener: ObtenerJwks = obtenerJwksPorDefecto,
  ahora = Date.now(),
): Promise<Jwk[]> {
  const url = `https://${teamDomain}/cdn-cgi/access/certs`;
  const cache = cacheJwks.get(url);
  if (cache && ahora < cache.expira) return cache.claves;
  const jwks = await obtener(url);
  const claves = Array.isArray(jwks.keys) ? jwks.keys : [];
  cacheJwks.set(url, { claves, expira: ahora + TTL_JWKS_MS });
  return claves;
}

/** Solo para pruebas: vacía la caché del JWKS. */
export function limpiarCacheJwks(): void {
  cacheJwks.clear();
}

export function base64UrlDecodificar(texto: string): Uint8Array<ArrayBuffer> {
  const normal = texto.replace(/-/g, "+").replace(/_/g, "/");
  const relleno = normal + "=".repeat((4 - (normal.length % 4)) % 4);
  const binario = atob(relleno);
  const bytes = new Uint8Array(new ArrayBuffer(binario.length));
  for (let i = 0; i < binario.length; i++) bytes[i] = binario.charCodeAt(i);
  return bytes;
}

export function base64UrlCodificar(bytes: Uint8Array): string {
  let binario = "";
  for (const b of bytes) binario += String.fromCharCode(b);
  return btoa(binario).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

interface CabeceraJwt {
  alg?: string;
  kid?: string;
}

export interface ReclamosAccess {
  email?: string;
  aud?: string | string[];
  iss?: string;
  exp?: number;
  nbf?: number;
  iat?: number;
  sub?: string;
}

export interface OpcionesAccess {
  teamDomain: string;
  aud: string;
  obtenerJwks?: ObtenerJwks;
  ahora?: number;
}

/**
 * Verifica el JWT de Access y devuelve sus reclamos, o null si no es válido.
 * Comprueba: alg RS256, firma contra la clave `kid`, `exp`/`nbf`, `iss` y `aud`.
 */
export async function verificarJwtAccess(
  token: string,
  opciones: OpcionesAccess,
): Promise<ReclamosAccess | null> {
  const partes = token.split(".");
  if (partes.length !== 3) return null;
  const [cab64, cuerpo64, firma64] = partes as [string, string, string];
  let cabecera: CabeceraJwt;
  let reclamos: ReclamosAccess;
  try {
    cabecera = JSON.parse(new TextDecoder().decode(base64UrlDecodificar(cab64))) as CabeceraJwt;
    reclamos = JSON.parse(
      new TextDecoder().decode(base64UrlDecodificar(cuerpo64)),
    ) as ReclamosAccess;
  } catch {
    return null;
  }
  if (cabecera.alg !== "RS256" || !cabecera.kid) return null;

  let claves: Jwk[];
  try {
    claves = await cargarJwks(opciones.teamDomain, opciones.obtenerJwks, opciones.ahora);
  } catch {
    return null;
  }
  const jwk = claves.find((k) => k.kid === cabecera.kid);
  if (!jwk) return null;

  let clave: CryptoKey;
  try {
    clave = await crypto.subtle.importKey(
      "jwk",
      jwk,
      { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
      false,
      ["verify"],
    );
  } catch {
    return null;
  }
  const datos = new TextEncoder().encode(`${cab64}.${cuerpo64}`);
  const valida = await crypto.subtle.verify(
    "RSASSA-PKCS1-v1_5",
    clave,
    base64UrlDecodificar(firma64),
    datos,
  );
  if (!valida) return null;

  const ahoraSeg = Math.floor((opciones.ahora ?? Date.now()) / 1000);
  if (typeof reclamos.exp !== "number" || reclamos.exp <= ahoraSeg) return null;
  if (typeof reclamos.nbf === "number" && reclamos.nbf > ahoraSeg + 60) return null;
  if (reclamos.iss !== `https://${opciones.teamDomain}`) return null;
  const audiencias = Array.isArray(reclamos.aud) ? reclamos.aud : [reclamos.aud];
  if (!audiencias.includes(opciones.aud)) return null;
  if (typeof reclamos.email !== "string" || !reclamos.email.includes("@")) return null;
  return reclamos;
}

/** Lee el token de Access de la petición (cabecera o cookie). */
export function extraerTokenAccess(request: Request): string | null {
  const cabecera = request.headers.get("Cf-Access-Jwt-Assertion");
  if (cabecera) return cabecera;
  const cookie = request.headers.get("Cookie") ?? "";
  const m = cookie.match(/(?:^|;\s*)CF_Authorization=([^;]+)/);
  return m?.[1] ?? null;
}

function listaCorreos(texto: string | undefined): Set<string> {
  return new Set(
    (texto ?? "")
      .split(",")
      .map((c) => c.trim().toLowerCase())
      .filter((c) => c.length > 0),
  );
}

/** Rol de un correo según ADMIN_EMAILS e INVESTIGADOR_EMAILS; null si no está en ninguna lista. */
export function rolDeCorreo(
  email: string,
  adminEmails: string | undefined,
  investigadorEmails: string | undefined,
): Rol | null {
  const correo = email.trim().toLowerCase();
  if (listaCorreos(adminEmails).has(correo)) return "admin";
  if (listaCorreos(investigadorEmails).has(correo)) return "investigador";
  return null;
}
