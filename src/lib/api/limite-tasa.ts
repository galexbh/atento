/**
 * Límite de tasa por IP en KV, sin guardar la IP.
 *
 * Clave: `rl:` + HMAC-SHA256(clave = sal, mensaje = IP) en hex. La sal es `RATE_SALT`
 * (obligatoria en producción: ver `faltaSal`) o, solo fuera de producción si no existe, una sal
 * derivada de la fecha UTC (cambia cada día, así que el hash no es correlacionable entre días).
 * Cada escritura usa TTL de 1 h, por lo que el contador expira solo.
 */
import { fechaUtc } from "./http";

export const MAX_ENVIOS_POR_HORA = 5;
export const TTL_LIMITE_S = 3600;
const PREFIJO = "rl:";

export interface OpcionesLimite {
  kv: KVNamespace;
  ip: string;
  sal?: string;
  maximo?: number;
  ahora?: Date;
}

/** Verdadero si el entorno es producción y no hay `RATE_SALT`: el endpoint debe responder 503. */
export function faltaSal(entorno: string | undefined, sal: string | undefined): boolean {
  return entorno === "produccion" && !(sal && sal.length > 0);
}

async function hmacHex(clave: string, mensaje: string): Promise<string> {
  const codificador = new TextEncoder();
  const k = await crypto.subtle.importKey(
    "raw",
    codificador.encode(clave),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const firma = await crypto.subtle.sign("HMAC", k, codificador.encode(mensaje));
  return [...new Uint8Array(firma)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function claveLimite(
  ip: string,
  sal: string | undefined,
  ahora: Date,
): Promise<string> {
  const salEfectiva = sal && sal.length > 0 ? sal : `atento:${fechaUtc(ahora)}`;
  return PREFIJO + (await hmacHex(salEfectiva, ip));
}

/**
 * Consume un intento. Devuelve `{ permitido, restantes }`.
 * No es estrictamente atómico (KV es eventualmente consistente), lo que es aceptable para un
 * límite anti-abuso de baja intensidad.
 */
export async function consumirIntento(
  o: OpcionesLimite,
): Promise<{ permitido: boolean; restantes: number }> {
  const maximo = o.maximo ?? MAX_ENVIOS_POR_HORA;
  const clave = await claveLimite(o.ip, o.sal, o.ahora ?? new Date());
  const actual = Number.parseInt((await o.kv.get(clave)) ?? "0", 10) || 0;
  if (actual >= maximo) return { permitido: false, restantes: 0 };
  await o.kv.put(clave, String(actual + 1), { expirationTtl: TTL_LIMITE_S });
  return { permitido: true, restantes: maximo - actual - 1 };
}
