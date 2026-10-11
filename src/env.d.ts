/// <reference types="astro/client" />
/// <reference types="@cloudflare/workers-types" />

// Bindings y variables del Worker (deben coincidir con wrangler.jsonc).
// Misma forma que genera `wrangler types`, escrita a mano para no depender del comando.
declare namespace Cloudflare {
  interface Env {
    /** Base de datos D1 (binding "DB", migraciones en ./migrations). */
    DB: D1Database;
    /** KV para caché y flags (binding "CACHE"). */
    CACHE: KVNamespace;
    /** Activos estáticos de ./dist (binding "ASSETS"). */
    ASSETS: Fetcher;
    /** Secreto de Turnstile: `wrangler secret put TURNSTILE_SECRET` o .dev.vars en local. */
    TURNSTILE_SECRET: string;
    /** URL pública canónica, p. ej. https://atento.galexbh.dev */
    SITE_URL: string;
    /** Entorno de ejecución. */
    ENTORNO: "local" | "preview" | "produccion";
  }
}

// `Env` global: es lo que espera el handler de @astrojs/cloudflare.
interface Env extends Cloudflare.Env {}

declare namespace Cloudflare {
  interface GlobalProps {
    /** Exportaciones del módulo principal (tipa `exports.default` de cloudflare:workers). */
    mainModule: typeof import("./worker");
  }
}

// `Runtime` aporta `cfContext` (ExecutionContext: waitUntil, etc.).
type RuntimeCloudflare = import("@astrojs/cloudflare").Runtime;

declare namespace App {
  interface Locals extends RuntimeCloudflare {
    /** Nonce CSP por petición; úsalo en `<script nonce={Astro.locals.nonce}>`. */
    nonce: string;
  }
}
