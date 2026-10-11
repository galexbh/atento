import { GET as getAgregado } from "@/pages/api/agregado";
import { GET as getPeriodos } from "@/pages/api/agregado/periodos";
import { GET as getGeo } from "@/pages/api/geo";
import { POST as postRespuesta } from "@/pages/api/respuesta";
import { GET as getSalud } from "@/pages/api/salud";

type Contexto = Parameters<typeof getSalud>[0];

/**
 * Worker mínimo para las pruebas en workerd: enruta a los handlers reales sin pasar por Astro
 * (ni por el middleware). Los handlers solo usan `request` y `env` de cloudflare:workers.
 */
export default {
  async fetch(request) {
    const url = new URL(request.url);
    const contexto = { request } as Contexto;
    switch (url.pathname) {
      case "/api/salud":
        return getSalud(contexto);
      case "/api/respuesta":
        if (request.method === "POST") return postRespuesta(contexto);
        return new Response("método no permitido", { status: 405 });
      case "/api/agregado":
        return getAgregado(contexto);
      case "/api/agregado/periodos":
        return getPeriodos(contexto);
      case "/api/geo":
        return getGeo(contexto);
      default:
        return new Response("no encontrado", { status: 404 });
    }
  },
} satisfies ExportedHandler<Env>;
