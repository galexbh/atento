import { env } from "cloudflare:workers";
import type { APIRoute } from "astro";
import { protegerApi, registrarAuditoria } from "@/lib/admin/proteger";
import { esNombreReporte, reporteConMeta } from "@/lib/reportes";
import { type Filtros, parsearFiltros } from "@/lib/reportes/filtros";

/**
 * Para el rol investigador, `municipio` no puede combinarse con edad, sexo o informante, ni con
 * periodos mensuales: ese cruce fino permitiría aislar respuestas individuales aunque las celdas
 * pequeñas se supriman. Devuelve el motivo del rechazo o null.
 */
export function validarFiltrosInvestigador(filtros: Filtros): string | null {
  if (!filtros.municipio) return null;
  const finos: string[] = [];
  if (filtros.edadMin !== undefined || filtros.edadMax !== undefined) finos.push("edad");
  if (filtros.sexo) finos.push("sexo");
  if (filtros.informante) finos.push("informante");
  if (/^\d{4}-(0[1-9]|1[0-2])$/.test(filtros.periodo)) finos.push("periodo mensual");
  if (finos.length === 0) return null;
  return `el rol investigador no puede combinar municipio con ${finos.join(", ")}`;
}

/**
 * GET /api/admin/reporte/<nombre>?periodo=2026&departamento=08...
 * Devuelve el reporte en JSON con metadatos. Cualquier rol autenticado; cada consulta queda en
 * auditoria_admin (acción `consulta`).
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
  if (auth.rol === "investigador") {
    const motivo = validarFiltrosInvestigador(filtros);
    if (motivo) return Response.json({ error: motivo }, { status: 403 });
  }
  const granularidadBruta = url.searchParams.get("granularidad");
  const granularidad =
    granularidadBruta === "semana" || granularidadBruta === "mes" ? granularidadBruta : "dia";
  const cuerpo = await reporteConMeta(env.DB, nombre, filtros, { granularidad });
  await registrarAuditoria(auth, "consulta", { ...filtros, reporte: nombre, granularidad }, null);
  return Response.json(cuerpo, { headers: { "Cache-Control": "no-store" } });
};
