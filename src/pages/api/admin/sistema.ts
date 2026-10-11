import type { APIRoute } from "astro";
import { procesarSistema } from "@/lib/admin/sesion";

/**
 * POST /api/admin/sistema (solo admin). Formulario con `accion`:
 * mantenimiento_on | mantenimiento_off | recalcular_agregados. Ver src/lib/admin/sesion.ts.
 */
export const POST: APIRoute = ({ request }) => procesarSistema(request);
