/**
 * Protección de páginas y endpoints bajo /admin y /api/admin.
 *
 * - `ADMIN_MODO = "access"` (defecto): valida el JWT de Cloudflare Access y asigna rol por correo.
 * - `ADMIN_MODO = "password"`: valida la cookie de sesión firmada (ver password.ts).
 *
 * Sin autenticación: 401 en API, redirección a /admin/entrar en páginas. Rol insuficiente: 403.
 * También registra la auditoría de exportaciones y consultas de microdatos.
 */
import { env } from "cloudflare:workers";
import {
  extraerTokenAccess,
  type Rol,
  rolDeCorreo,
  type Usuario,
  verificarJwtAccess,
} from "./acceso";
import { leerCookie, NOMBRE_COOKIE, verificarSesion } from "./password";

export type { Rol, Usuario } from "./acceso";

export function modoAdmin(): "access" | "password" {
  return env.ADMIN_MODO === "password" ? "password" : "access";
}

export function secretoSesion(): string | null {
  return env.ADMIN_SESSION_SECRET || env.ADMIN_PASSWORD_HASH || null;
}

/** Sal para el hash de IP del límite de intentos (RATE_SALT o, si falta, el secreto de sesión). */
export function salIntentos(): string {
  return env.RATE_SALT || secretoSesion() || "atento";
}

/**
 * En producción ADMIN_SESSION_SECRET es obligatorio (firma de cookies y seudónimos de
 * microdatos). Devuelve una Response 503 si falta; null si la configuración es válida.
 */
export function errorConfiguracionAdmin(): Response | null {
  if (env.ENTORNO === "produccion" && !env.ADMIN_SESSION_SECRET) {
    console.error("ADMIN_SESSION_SECRET no configurado en producción: panel /admin deshabilitado");
    return json({ error: "configuracion", detalle: "ADMIN_SESSION_SECRET no configurado" }, 503);
  }
  return null;
}

const CLAVE_NO_ANTES_DE = "sesiones_no_antes_de";

/** Segundos Unix antes de los cuales ninguna sesión es válida (0 si no se ha fijado). */
export async function leerSesionesNoAntesDe(): Promise<number> {
  try {
    const fila = await env.DB.prepare("SELECT valor FROM configuracion WHERE clave = ?")
      .bind(CLAVE_NO_ANTES_DE)
      .first<{ valor: string | null }>();
    const n = Number(fila?.valor ?? 0);
    return Number.isFinite(n) ? n : 0;
  } catch {
    return 0;
  }
}

/** Invalida todas las sesiones emitidas hasta ahora ("cerrar todas las sesiones"). */
export async function cerrarTodasLasSesiones(ahora = Date.now()): Promise<number> {
  const valor = Math.floor(ahora / 1000);
  await env.DB.prepare(
    "INSERT INTO configuracion (clave, valor) VALUES (?, ?) ON CONFLICT(clave) DO UPDATE SET valor = excluded.valor",
  )
    .bind(CLAVE_NO_ANTES_DE, String(valor))
    .run();
  return valor;
}

/** Identifica al usuario de la petición o devuelve null. */
export async function autenticar(request: Request): Promise<Usuario | null> {
  if (modoAdmin() === "password") {
    const secreto = secretoSesion();
    const cookie = leerCookie(request, NOMBRE_COOKIE);
    if (!secreto || !cookie) return null;
    const sesion = await verificarSesion(
      secreto,
      cookie,
      Date.now(),
      await leerSesionesNoAntesDe(),
    );
    return sesion ? { email: sesion.u, rol: sesion.r, mecanismo: "password" } : null;
  }
  const token = extraerTokenAccess(request);
  if (!token || !env.ACCESS_TEAM_DOMAIN || !env.ACCESS_AUD) return null;
  const reclamos = await verificarJwtAccess(token, {
    teamDomain: env.ACCESS_TEAM_DOMAIN,
    aud: env.ACCESS_AUD,
  });
  if (!reclamos?.email) return null;
  const rol = rolDeCorreo(reclamos.email, env.ADMIN_EMAILS, env.INVESTIGADOR_EMAILS);
  if (!rol) return null;
  return { email: reclamos.email, rol, mecanismo: "access" };
}

function tieneRol(usuario: Usuario, rolMinimo: Rol): boolean {
  return rolMinimo === "investigador" || usuario.rol === "admin";
}

function json(cuerpo: unknown, status: number): Response {
  return new Response(JSON.stringify(cuerpo), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });
}

/** Para endpoints JSON: devuelve el usuario o una Response 401/403 lista para retornar. */
export async function protegerApi(
  request: Request,
  rolMinimo: Rol = "investigador",
): Promise<Usuario | Response> {
  const configuracion = errorConfiguracionAdmin();
  if (configuracion) return configuracion;
  const usuario = await autenticar(request);
  if (!usuario) return json({ error: "no autenticado" }, 401);
  if (!tieneRol(usuario, rolMinimo)) return json({ error: "rol insuficiente" }, 403);
  return usuario;
}

/** Para páginas: devuelve el usuario o una redirección a /admin/entrar (401) o un 403. */
export async function protegerPagina(
  request: Request,
  rolMinimo: Rol = "investigador",
): Promise<Usuario | Response> {
  const configuracion = errorConfiguracionAdmin();
  if (configuracion) return configuracion;
  const usuario = await autenticar(request);
  if (!usuario) {
    const destino = new URL(request.url);
    const volver = encodeURIComponent(destino.pathname + destino.search);
    return new Response(null, {
      status: 302,
      headers: { Location: `/admin/entrar?volver=${volver}`, "Cache-Control": "no-store" },
    });
  }
  if (!tieneRol(usuario, rolMinimo)) {
    return new Response("Acceso denegado: tu rol no permite esta sección.", {
      status: 403,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }
  return usuario;
}

export type AccionAuditoria =
  | "exportar_agregados"
  | "exportar_microdatos"
  | "exportar_codebook"
  | "consultar_microdatos"
  | "consulta"
  | "mantenimiento_on"
  | "mantenimiento_off"
  | "recalcular_agregados"
  | "cerrar_sesiones"
  | "entrar"
  | "salir";

/** Inserta una fila en auditoria_admin. Nunca lanza: una falla de auditoría no bloquea la acción. */
export async function registrarAuditoria(
  usuario: Usuario | string,
  accion: AccionAuditoria,
  filtros: unknown = null,
  filas: number | null = null,
): Promise<void> {
  const quien = typeof usuario === "string" ? usuario : usuario.email;
  try {
    await env.DB.prepare(
      "INSERT INTO auditoria_admin (fecha_hora, usuario, accion, filtros, filas) VALUES (?, ?, ?, ?, ?)",
    )
      .bind(
        new Date().toISOString(),
        quien,
        accion,
        filtros === null ? null : JSON.stringify(filtros),
        filas,
      )
      .run();
  } catch (error) {
    console.error("auditoria_admin: no se pudo registrar", error);
  }
}

export interface FilaAuditoria {
  id: number;
  fecha_hora: string;
  usuario: string;
  accion: string;
  filtros: string | null;
  filas: number | null;
}

export async function leerAuditoria(limite = 50): Promise<FilaAuditoria[]> {
  const r = await env.DB.prepare(
    "SELECT id, fecha_hora, usuario, accion, filtros, filas FROM auditoria_admin ORDER BY id DESC LIMIT ?",
  )
    .bind(limite)
    .all<FilaAuditoria>();
  return r.results;
}
