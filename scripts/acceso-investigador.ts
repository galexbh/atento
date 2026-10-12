/**
 * Crea, rota o revoca la contraseña del rol investigador (modo password del panel).
 *
 *   pnpm acceso:investigador                 # producción
 *   pnpm acceso:investigador -- --preview    # preview
 *   pnpm acceso:investigador -- --revocar    # elimina el acceso (añade --preview para preview)
 *
 * La contraseña se genera al azar, se guarda en un archivo en la carpeta temporal del sistema y
 * nunca se imprime en la terminal. Solo el hash viaja a Cloudflare, por stdin.
 * Después de rotar o revocar, usa "Cerrar todas las sesiones" en Sistema para invalidar las
 * sesiones abiertas con la contraseña anterior.
 */
import { spawnSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { generarHash } from "../src/lib/admin/password";

const SECRETO = "INVESTIGADOR_PASSWORD_HASH";
const argumentos = process.argv.slice(2);
const preview = argumentos.includes("--preview");
const revocar = argumentos.includes("--revocar");
const entorno = preview ? ["--env", "preview"] : [];
const nombreEntorno = preview ? "preview" : "producción";

function wrangler(args: string[], entrada?: string): number {
  const r = spawnSync("pnpm", ["exec", "wrangler", ...args, ...entorno], {
    input: entrada,
    stdio: ["pipe", "ignore", "inherit"],
    shell: process.platform === "win32",
  });
  return r.status ?? 1;
}

if (revocar) {
  const estado = wrangler(["secret", "delete", SECRETO], "y\n");
  if (estado !== 0) process.exit(estado);
  console.log(`Acceso de investigación revocado en ${nombreEntorno}.`);
  console.log(
    'Cierra las sesiones abiertas desde el panel: Sistema → "Cerrar todas las sesiones".',
  );
  process.exit(0);
}

// 18 bytes aleatorios → 24 caracteres base64url, unos 144 bits de entropía.
const bytes = crypto.getRandomValues(new Uint8Array(18));
const contrasena = btoa(String.fromCharCode(...bytes))
  .replace(/\+/g, "-")
  .replace(/\//g, "_")
  .replace(/=+$/, "");
const hash = await generarHash(contrasena);
const estado = wrangler(["secret", "put", SECRETO], hash);
if (estado !== 0) {
  console.error("No se pudo guardar el secreto en Cloudflare. No se creó ningún acceso.");
  process.exit(estado);
}
const archivo = join(tmpdir(), `atento-investigador-${preview ? "preview" : "produccion"}.txt`);
writeFileSync(archivo, `${contrasena}\n`, { mode: 0o600 });
console.log(`Acceso de investigación creado en ${nombreEntorno}.`);
console.log(`La contraseña está en: ${archivo}`);
console.log("Compártela por un canal privado, luego borra ese archivo.");
