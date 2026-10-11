/**
 * Genera el hash PBKDF2 para ADMIN_PASSWORD_HASH (modo de respaldo del panel /admin).
 *
 *   pnpm tsx scripts/hash-password.ts "mi contraseña larga"
 *   pnpm tsx scripts/hash-password.ts            # la pide por stdin sin eco
 *
 * Pega la salida en `wrangler secret put ADMIN_PASSWORD_HASH` o en .dev.vars.
 */
import { stdin, stdout } from "node:process";
import { createInterface } from "node:readline/promises";
import { generarHash } from "../src/lib/admin/password";

async function leerContrasena(): Promise<string> {
  const arg = process.argv[2];
  if (arg) return arg;
  const rl = createInterface({ input: stdin, output: stdout, terminal: true });
  const valor = await rl.question("Contraseña: ");
  rl.close();
  return valor;
}

const contrasena = await leerContrasena();
if (contrasena.length < 12) {
  console.error("Usa al menos 12 caracteres.");
  process.exit(1);
}
console.log(await generarHash(contrasena));
