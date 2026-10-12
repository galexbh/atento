// Variables de entorno del panel de administración (/admin). Se fusionan con Cloudflare.Env de
// src/env.d.ts. Todas son `vars` de wrangler.jsonc salvo las marcadas como secreto.
//
// Copiar a wrangler.jsonc > vars (y a .dev.vars en local):
//   "ACCESS_TEAM_DOMAIN": "mi-equipo.cloudflareaccess.com",   // dominio del equipo Zero Trust
//   "ACCESS_AUD": "<audience tag de la aplicación Access>",   // Access > Applications > Overview
//   "ADMIN_EMAILS": "persona@ejemplo.org",                     // rol admin (separados por coma)
//   "INVESTIGADOR_EMAILS": "socio@unah.edu.hn",               // rol investigador (solo lectura)
//   "ADMIN_MODO": "access"                                      // "access" (defecto) o "password"
// Secretos (wrangler secret put ...), solo si ADMIN_MODO = "password":
//   ADMIN_PASSWORD_HASH   hash generado con `pnpm tsx scripts/hash-password.ts`
//   ADMIN_SESSION_SECRET  cadena aleatoria larga para firmar la cookie de sesión y seudonimizar
//                         ids en microdatos. Obligatoria en producción (503 si falta); en local,
//                         si falta, se deriva de ADMIN_PASSWORD_HASH.
declare namespace Cloudflare {
  interface Env {
    /** Dominio del equipo de Cloudflare Access, p. ej. "atento.cloudflareaccess.com". */
    ACCESS_TEAM_DOMAIN?: string;
    /** Audience (AUD) de la aplicación de Access que protege /admin. */
    ACCESS_AUD?: string;
    /** Correos con rol admin, separados por coma. */
    ADMIN_EMAILS?: string;
    /** Correos con rol investigador (solo lectura y agregados), separados por coma. */
    INVESTIGADOR_EMAILS?: string;
    /** "access" (por defecto) valida el JWT de Access; "password" usa contraseña y cookie. */
    ADMIN_MODO?: "access" | "password";
    /** Hash PBKDF2 de la contraseña de respaldo (`pbkdf2$<iter>$<sal>$<hash>`). */
    ADMIN_PASSWORD_HASH?: string;
    /** Opcional: contraseña del rol investigador en modo password (scripts/acceso-investigador.ts). */
    INVESTIGADOR_PASSWORD_HASH?: string;
    /** Secreto HMAC de la cookie de sesión y de los seudónimos de microdatos (obligatorio en producción). */
    ADMIN_SESSION_SECRET?: string;
  }
}
