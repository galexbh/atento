import { env } from "cloudflare:workers";
import type { APIRoute } from "astro";
import { protegerApi, registrarAuditoria } from "@/lib/admin/proteger";
import { fechaUtc } from "@/lib/api/http";
import { esNombreReporte, type NombreReporte, reporteConMeta } from "@/lib/reportes";
import {
  aCsv,
  COLUMNAS_MICRODATOS,
  exportarMicrodatos,
  filasDeReporte,
  generarCodebook,
  nombreArchivo,
  validarFiltrosMicrodatos,
} from "@/lib/reportes/exportar";
import { parsearFiltros } from "@/lib/reportes/filtros";

/**
 * GET /api/admin/exportar?tipo=agregados|microdatos|codebook&formato=csv|json&reporte=geografia&...filtros
 *
 * - agregados: cualquier rol; el reporte indicado (por defecto geografia).
 * - microdatos: solo admin; solo respuestas con consentimiento; anonimizados (ver exportar.ts).
 *   Solo admite periodo anual o acumulado, departamento y versionInstrumento (400 si hay otros).
 * - codebook: diccionario de variables en Markdown.
 * Toda exportación queda en auditoria_admin.
 */
export const GET: APIRoute = async ({ request }) => {
  const url = new URL(request.url);
  const tipo = url.searchParams.get("tipo") ?? "agregados";
  const formato = url.searchParams.get("formato") === "json" ? "json" : "csv";
  const auth = await protegerApi(request, tipo === "microdatos" ? "admin" : "investigador");
  if (auth instanceof Response) return auth;
  const filtros = parsearFiltros(url.searchParams);

  if (tipo === "codebook") {
    const md = generarCodebook();
    await registrarAuditoria(auth, "exportar_codebook", null, null);
    return new Response(md, {
      headers: {
        "Content-Type": "text/markdown; charset=utf-8",
        "Content-Disposition": `attachment; filename="atento-codebook.md"`,
        "Cache-Control": "no-store",
      },
    });
  }

  if (tipo === "microdatos") {
    const motivo = validarFiltrosMicrodatos(filtros);
    if (motivo) return Response.json({ error: motivo }, { status: 400 });
    const secreto = env.ADMIN_SESSION_SECRET || env.ADMIN_PASSWORD_HASH;
    if (!secreto) {
      console.error("exportar_microdatos: falta ADMIN_SESSION_SECRET para seudonimizar ids");
      return Response.json({ error: "configuracion" }, { status: 503 });
    }
    const fecha = fechaUtc();
    const filas = await exportarMicrodatos(env.DB, filtros, { secreto, fecha });
    await registrarAuditoria(auth, "exportar_microdatos", { ...filtros, formato }, filas.length);
    const nombre = nombreArchivo("microdatos", filtros.periodo, formato);
    if (formato === "json") {
      return descargar(
        JSON.stringify({
          meta: { periodo: filtros.periodo, filtros, filas: filas.length, descargadoEn: fecha },
          datos: filas,
        }),
        nombre,
        "application/json; charset=utf-8",
      );
    }
    return descargar(aCsv(filas, COLUMNAS_MICRODATOS), nombre, "text/csv; charset=utf-8");
  }

  if (tipo !== "agregados") return Response.json({ error: "tipo desconocido" }, { status: 400 });
  const reporteBruto = url.searchParams.get("reporte") ?? "geografia";
  if (!esNombreReporte(reporteBruto)) {
    return Response.json({ error: "reporte desconocido" }, { status: 400 });
  }
  const reporte: NombreReporte = reporteBruto;
  const cuerpo = await reporteConMeta(env.DB, reporte, filtros);
  const filas = filasDeReporte(reporte, cuerpo.datos);
  await registrarAuditoria(
    auth,
    "exportar_agregados",
    { ...filtros, reporte, formato },
    filas.length,
  );
  const nombre = nombreArchivo(`agregados-${reporte}`, filtros.periodo, formato);
  if (formato === "json") {
    return descargar(JSON.stringify(cuerpo), nombre, "application/json; charset=utf-8");
  }
  return descargar(aCsv(filas), nombre, "text/csv; charset=utf-8");
};

function descargar(cuerpo: string, nombre: string, tipo: string): Response {
  return new Response(cuerpo, {
    headers: {
      "Content-Type": tipo,
      "Content-Disposition": `attachment; filename="${nombre}"`,
      "Cache-Control": "no-store",
    },
  });
}
