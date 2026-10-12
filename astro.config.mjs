// @ts-check
import cloudflare from "@astrojs/cloudflare";
import sitemap from "@astrojs/sitemap";
import { defineConfig } from "astro/config";

// Configuración de Astro para Atento (https://atento.galexbh.dev).
// - `output: "server"`: todas las páginas se renderizan bajo demanda en Cloudflare Workers.
// - Adaptador Cloudflare v14: usa @cloudflare/vite-plugin; `astro dev` ya corre dentro de workerd
//   con los bindings de wrangler.jsonc (D1 y KV locales en .wrangler/state).
// - `imageService: "compile"`: las imágenes se optimizan en build; evita requerir el binding IMAGES.
// - `session: false`: sin sesiones por ahora; evita que el adaptador exija un KV "SESSION".
//   Si más adelante se necesitan sesiones, usar `cloudflare({ sessionKVBindingName: "CACHE" })`.
export default defineConfig({
  site: "https://atento.galexbh.dev",
  output: "server",
  adapter: cloudflare({
    imageService: "compile",
  }),
  session: false,
  integrations: [
    sitemap({
      // En `output: "server"` solo entran rutas estáticas; /legal/[slug] se añade a mano.
      customPages: [
        "terminos",
        "privacidad",
        "aviso-de-salud",
        "cookies",
        "accesibilidad",
        "datos-abiertos",
        "creditos",
      ].map((slug) => `https://atento.galexbh.dev/legal/${slug}`),
      filter: (url) => !/\/(resultado|cribado|admin|api|offline)(\/|$)/.test(new URL(url).pathname),
      // Mismo formato que <link rel="canonical"> (sin barra final).
      serialize: (item) => ({
        ...item,
        url:
          item.url.endsWith("/") && new URL(item.url).pathname !== "/"
            ? item.url.slice(0, -1)
            : item.url,
      }),
    }),
  ],
  // El dev toolbar inyecta scripts inline que la CSP con nonce bloquearía (ver src/middleware.ts).
  devToolbar: { enabled: false },
  vite: {
    resolve: {
      alias: { "@": new URL("./src", import.meta.url).pathname },
    },
  },
});
