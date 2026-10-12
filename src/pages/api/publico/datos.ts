import { env } from "cloudflare:workers";
import type { APIRoute } from "astro";
import { z } from "zod";
import { respuestaCacheable } from "@/lib/api/cache";
import { error, formatearErrores, registrar } from "@/lib/api/http";
import {
  LICENCIA_URL,
  nombreArchivo,
  type Publicacion,
  publicacionACsv,
} from "@/lib/publico/datos";
import { obtenerPublicacionJson } from "@/lib/publico/publicar";

export const prerender = false;

const Esquema = z
  .object({
    anio: z.string().regex(/^\d{4}$/, "anio inválido: solo año calendario (AAAA)"),
    formato: z.enum(["json", "csv"]).default("json"),
  })
  .strict();

/**
 * GET /api/publico/datos?anio=2026[&formato=csv|json]
 *
 * Publicación anual segura (supresión primaria y complementaria; ver src/lib/publico/datos.ts).
 * 404 si el año no tiene datos publicables. Caché KV 1 h, ETag/304,
 * `Cache-Control: public, max-age=300, s-maxage=3600`. Licencia CC BY 4.0 (cabecera Link).
 */
export const GET: APIRoute = async ({ request }) => {
  const inicio = Date.now();
  const url = new URL(request.url);
  const validacion = Esquema.safeParse(Object.fromEntries(url.searchParams));
  if (!validacion.success) {
    registrar("publico_datos", 400, inicio);
    return error(400, "parametros", { errores: formatearErrores(validacion.error.issues) });
  }
  const { anio, formato } = validacion.data;
  try {
    const { cuerpo, desdeCache } = await obtenerPublicacionJson(env, Number(anio));
    if (cuerpo === null) {
      registrar("publico_datos", 404, inicio);
      return error(404, "sin_datos");
    }
    const p = JSON.parse(cuerpo) as Publicacion;
    const r =
      formato === "csv"
        ? await respuestaCacheable(request, publicacionACsv(p), { tipo: "text/csv; charset=utf-8" })
        : await respuestaCacheable(request, cuerpo);
    r.headers.set("X-Cache", desdeCache ? "HIT" : "MISS");
    r.headers.set("Link", `<${LICENCIA_URL}>; rel="license"`);
    r.headers.set(
      "Content-Disposition",
      `${formato === "csv" ? "attachment" : "inline"}; filename="${nombreArchivo(p, formato)}"`,
    );
    registrar("publico_datos", r.status, inicio);
    return r;
  } catch {
    registrar("publico_datos", 503, inicio);
    return error(503, "no_disponible");
  }
};
