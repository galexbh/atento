import type { APIRoute } from "astro";
import { procesarEntrar } from "@/lib/admin/sesion";

/**
 * POST /api/admin/entrar (solo en ADMIN_MODO = "password"): formulario con `contrasena` y
 * opcionalmente `volver`. La misma lógica atiende el POST de la página /admin/entrar.
 */
export const POST: APIRoute = ({ request }) => procesarEntrar(request);
