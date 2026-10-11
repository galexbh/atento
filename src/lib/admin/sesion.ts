/**
 * Acciones con formulario del panel (entrar, salir, sistema). Las usan tanto las páginas Astro
 * (POST a /admin/entrar, /admin/salir, /admin/sistema) como los endpoints /api/admin/*.
 */
import { env } from "cloudflare:workers";
import {
  cabeceraBorrarCookie,
  cabeceraCookieSesion,
  crearSesion,
  estaBloqueada,
  ipDePeticion,
  limpiarIntentos,
  registrarIntentoFallido,
  verificarContrasena,
} from "./password";
import { autenticar, modoAdmin, protegerApi, registrarAuditoria, secretoSesion } from "./proteger";

function redirigir(destino: string, extra: Record<string, string> = {}): Response {
  return new Response(null, {
    status: 303,
    headers: { Location: destino, "Cache-Control": "no-store", ...extra },
  });
}

function cookieSegura(): boolean {
  return env.ENTORNO !== "local";
}

/**
 * Entrada con contraseña (solo ADMIN_MODO = "password"): verifica contra ADMIN_PASSWORD_HASH,
 * limita a 5 intentos/15 min por hash de IP (KV) y emite la cookie de sesión firmada.
 */
export async function procesarEntrar(request: Request): Promise<Response> {
  if (modoAdmin() !== "password") {
    return Response.json({ error: "modo password desactivado" }, { status: 404 });
  }
  const hash = env.ADMIN_PASSWORD_HASH;
  const secreto = secretoSesion();
  if (!hash || !secreto) {
    return Response.json({ error: "ADMIN_PASSWORD_HASH no configurado" }, { status: 503 });
  }
  const ip = ipDePeticion(request);
  if (await estaBloqueada(env.CACHE, ip)) return redirigir("/admin/entrar?error=bloqueado");
  const datos = await request.formData().catch(() => null);
  const contrasena = String(datos?.get("contrasena") ?? "");
  const volverBruto = String(datos?.get("volver") ?? "/admin");
  const volver = /^\/admin(\/[\w\-/?=&%.]*)?$/.test(volverBruto) ? volverBruto : "/admin";
  if (!contrasena || !(await verificarContrasena(contrasena, hash))) {
    const intentos = await registrarIntentoFallido(env.CACHE, ip);
    return redirigir(`/admin/entrar?error=${intentos >= 5 ? "bloqueado" : "credenciales"}`);
  }
  await limpiarIntentos(env.CACHE, ip);
  const usuario = "admin (password)";
  const cookie = await crearSesion(secreto, usuario, "admin");
  await registrarAuditoria(usuario, "entrar", null, null);
  return redirigir(volver, { "Set-Cookie": cabeceraCookieSesion(cookie, cookieSegura()) });
}

/** Cierra la sesión del modo password (borra la cookie) y vuelve a /admin/entrar. */
export async function procesarSalir(request: Request): Promise<Response> {
  const usuario = await autenticar(request);
  if (usuario) await registrarAuditoria(usuario, "salir", null, null);
  return redirigir("/admin/entrar", { "Set-Cookie": cabeceraBorrarCookie(cookieSegura()) });
}

type Recalculador = (e: typeof env) => Promise<unknown>;

/** Carga perezosa del módulo de agregados (propiedad de otro módulo); null si aún no existe. */
export async function obtenerRecalculador(): Promise<Recalculador | null> {
  const modulos = import.meta.glob<Record<string, unknown>>("../agregados/*.ts");
  for (const cargar of Object.values(modulos)) {
    try {
      const mod = await cargar();
      if (typeof mod.recalcularAgregados === "function") {
        return mod.recalcularAgregados as Recalculador;
      }
    } catch {
      // Módulo sin esa exportación o con error de carga: se prueba el siguiente.
    }
  }
  return null;
}

/**
 * Acciones de sistema (solo admin): mantenimiento_on/off (configuracion) y recalcular_agregados.
 * Responde JSON si la petición acepta application/json; si no, redirige a /admin/sistema?msg=...
 */
export async function procesarSistema(request: Request): Promise<Response> {
  const auth = await protegerApi(request, "admin");
  if (auth instanceof Response) return auth;
  const datos = await request.formData().catch(() => null);
  const accion = String(datos?.get("accion") ?? "");
  let mensaje: string;
  if (accion === "mantenimiento_on" || accion === "mantenimiento_off") {
    const valor = accion === "mantenimiento_on" ? "1" : "0";
    await env.DB.prepare(
      "INSERT INTO configuracion (clave, valor) VALUES ('mantenimiento', ?) ON CONFLICT(clave) DO UPDATE SET valor = excluded.valor",
    )
      .bind(valor)
      .run();
    await registrarAuditoria(auth, accion, null, null);
    mensaje = valor === "1" ? "mantenimiento-activado" : "mantenimiento-desactivado";
  } else if (accion === "recalcular_agregados") {
    const recalcular = await obtenerRecalculador();
    if (!recalcular) {
      mensaje = "recalculo-pendiente";
    } else {
      try {
        await recalcular(env);
        await registrarAuditoria(auth, "recalcular_agregados", null, null);
        mensaje = "recalculo-ok";
      } catch (error) {
        console.error("recalcularAgregados falló", error);
        mensaje = "recalculo-error";
      }
    }
  } else {
    return Response.json({ error: "acción desconocida" }, { status: 400 });
  }
  if (request.headers.get("Accept")?.includes("application/json")) {
    return Response.json({ ok: true, mensaje });
  }
  return redirigir(`/admin/sistema?msg=${mensaje}`);
}
