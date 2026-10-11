import { env } from "cloudflare:workers";
import type { APIRoute } from "astro";

export const VERSION = "0.1.0";

/** GET /api/salud — comprobación de vida del servicio. */
export const GET: APIRoute = () => {
  return Response.json(
    { ok: true, entorno: env.ENTORNO ?? "local", version: VERSION },
    { headers: { "Cache-Control": "no-store" } },
  );
};
