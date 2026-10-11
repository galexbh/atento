import { handle } from "@astrojs/cloudflare/handler";

/**
 * Punto de entrada del Worker (wrangler.jsonc -> main).
 * `fetch` delega en Astro; `scheduled` atiende los crons de wrangler.jsonc (triggers.crons).
 */
export default {
  fetch: handle,
  async scheduled(controller, _env, _ctx) {
    // TODO(agregados): recalcular agregados_municipio / agregados_psicometria.
    // La lógica vive en src/lib (otro módulo); aquí solo se orquesta.
    const cuando = new Date(controller.scheduledTime).toISOString();
    console.log(`cron ${controller.cron} ejecutado en ${cuando}`);
  },
} satisfies ExportedHandler<Env>;
