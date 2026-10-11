import type { APIContext } from "astro";
import { POST as entrar } from "@/pages/api/admin/entrar";
import { GET as exportar } from "@/pages/api/admin/exportar";
import { GET as reporte } from "@/pages/api/admin/reporte/[nombre]";
import { POST as salir } from "@/pages/api/admin/salir";
import { POST as sistema } from "@/pages/api/admin/sistema";

/**
 * Worker mínimo para probar los endpoints de /api/admin en workerd sin pasar por Astro.
 * Los handlers solo usan `request` del contexto, así que se les pasa un contexto parcial.
 */
function contexto(request: Request): APIContext {
  return { request, url: new URL(request.url) } as unknown as APIContext;
}

export default {
  async fetch(request) {
    const url = new URL(request.url);
    const ruta = url.pathname;
    if (ruta.startsWith("/api/admin/reporte/")) return reporte(contexto(request));
    if (ruta === "/api/admin/exportar") return exportar(contexto(request));
    if (ruta === "/api/admin/sistema" && request.method === "POST")
      return sistema(contexto(request));
    if (ruta === "/api/admin/entrar" && request.method === "POST") return entrar(contexto(request));
    if (ruta === "/api/admin/salir" && request.method === "POST") return salir(contexto(request));
    return new Response(`no encontrado: ${request.method} ${ruta}`, { status: 404 });
  },
} satisfies ExportedHandler<Env>;
