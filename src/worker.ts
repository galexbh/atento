import { handle } from "@astrojs/cloudflare/handler";
import { ejecutarCronDiario } from "./lib/agregados/recalcular";

/**
 * Punto de entrada del Worker (wrangler.jsonc -> main).
 * `fetch` delega en Astro; `scheduled` atiende los crons de wrangler.jsonc (triggers.crons).
 *
 * Cron diario (03:00 UTC): recalcula `agregados_municipio` en lotes, invalida la caché KV
 * `agregado:*` y, el 1 de enero, congela el año anterior en `agregados_anuales` (dataset "v1").
 * En local: `wrangler dev --test-scheduled` y `curl "http://127.0.0.1:8787/__scheduled?cron=0+3+*+*+*"`,
 * o bien `pnpm agregar:local` (misma lógica sin servidor).
 */
export default {
  fetch: handle,
  async scheduled(controller, env, ctx) {
    const inicio = Date.now();
    const ahora = new Date(controller.scheduledTime);
    ctx.waitUntil(
      ejecutarCronDiario(env, ahora)
        .then((r) => {
          console.log(
            JSON.stringify({
              evento: "cron_agregados",
              cron: controller.cron,
              status: 200,
              ms: Date.now() - inicio,
              filasLeidas: r.filasLeidas,
              agregadosEscritos: r.agregadosEscritos,
              snapshot: r.snapshot,
            }),
          );
        })
        .catch((e: unknown) => {
          console.error(
            JSON.stringify({
              evento: "cron_agregados",
              cron: controller.cron,
              status: 500,
              ms: Date.now() - inicio,
              error: e instanceof Error ? e.message : String(e),
            }),
          );
        }),
    );
  },
} satisfies ExportedHandler<Env>;
