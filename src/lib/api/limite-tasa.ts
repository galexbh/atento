/**
 * Límite de tasa por IP en KV, sin guardar la IP.
 *
 * Clave: `rl:` + SHA-256(IP + ":" + sal). La sal es `RATE_SALT` si existe o, si no, una sal
 * derivada de la fecha UTC (cambia cada día, así que el hash no es correlacionable entre días).
 * Cada escritura usa TTL de 1 h, por lo que el contador expira solo.
 */
import { fechaUtc, sha256Hex } from "./http";

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

export async function claveLimite(
  ip: string,
  sal: string | undefined,
  ahora: Date,
): Promise<string> {
  const salEfectiva = sal && sal.length > 0 ? sal : `atento:${fechaUtc(ahora)}`;
  return PREFIJO + (await sha256Hex(`${ip}:${salEfectiva}`));
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
