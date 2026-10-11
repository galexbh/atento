import type { APIRoute } from "astro";
import { respuestaCacheable } from "@/lib/api/cache";
import { error } from "@/lib/api/http";
import geoDepartamentos from "../../../public/geo/honduras-departamentos.geojson?raw";

export const prerender = false;

/**
 * GET /api/geo?nivel=departamento — GeoJSON de departamentos (ODbL, ver "fuente" en el archivo).
 *
 * Decisión: el archivo (~28 KB) se incrusta en el Worker en tiempo de build (`?raw`) en lugar de
 * redirigir a /geo/honduras-departamentos.geojson. Así la respuesta lleva Content-Type
 * `application/geo+json`, ETag y caché larga fijados aquí, y el endpoint funciona igual en
 * pruebas (sin binding ASSETS). El estático sigue disponible en /geo/ para quien prefiera.
 * Solo existe el nivel "departamento"; "municipio" devuelve 404 hasta que haya capa municipal.
 */
export const GET: APIRoute = async ({ request }) => {
  const nivel = new URL(request.url).searchParams.get("nivel") ?? "departamento";
  if (nivel === "departamento") {
    return respuestaCacheable(request, geoDepartamentos, {
      tipo: "application/geo+json; charset=utf-8",
      cacheControl: "public, max-age=86400, s-maxage=604800",
    });
  }
  if (nivel === "municipio") return error(404, "nivel_no_disponible");
  return error(400, "parametros", { errores: [{ campo: "nivel", mensaje: "nivel inválido" }] });
};
