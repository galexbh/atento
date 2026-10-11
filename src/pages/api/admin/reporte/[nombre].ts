import { env } from "cloudflare:workers";
import type { APIRoute } from "astro";
import { protegerApi } from "@/lib/admin/proteger";
import { esNombreReporte, reporteConMeta } from "@/lib/reportes";
import { parsearFiltros } from "@/lib/reportes/filtros";

/**
 * GET /api/admin/reporte/<nombre>?periodo=2026&departamento=08...
 * Devuelve el reporte en JSON con metadatos. Cualquier rol autenticado.
 */
export const GET: APIRoute = async ({ request }) => {
  const auth = await protegerApi(request);
  if (auth instanceof Response) return auth;
  const url = new URL(request.url);
  const nombre = url.pathname.split("/").filter(Boolean).pop() ?? "";
  if (!esNombreReporte(nombre)) {
    return Response.json({ error: "reporte desconocido" }, { status: 404 });
  }
  const filtros = parsearFiltros(url.searchParams);
  const granularidadBruta = url.searchParams.get("granularidad");
  const granularidad =
    granularidadBruta === "semana" || granularidadBruta === "mes" ? granularidadBruta : "dia";
  const cuerpo = await reporteConMeta(env.DB, nombre, filtros, { granularidad });
  return Response.json(cuerpo, { headers: { "Cache-Control": "no-store" } });
};
