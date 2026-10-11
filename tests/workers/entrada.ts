import { GET } from "@/pages/api/salud";

/** Worker mínimo para las pruebas en workerd: expone /api/salud sin pasar por Astro. */
export default {
  async fetch(request) {
    const url = new URL(request.url);
    if (url.pathname === "/api/salud") {
      // El endpoint solo usa `env` de cloudflare:workers; el contexto de Astro no es necesario.
      return GET({} as Parameters<typeof GET>[0]);
    }
    return new Response("no encontrado", { status: 404 });
  },
} satisfies ExportedHandler<Env>;
