import type { APIRoute } from "astro";
import { procesarSalir } from "@/lib/admin/sesion";

/** POST /api/admin/salir: borra la cookie de sesión del modo password y vuelve a /admin/entrar. */
export const POST: APIRoute = ({ request }) => procesarSalir(request);
