import { env } from "cloudflare:workers";
import type { APIRoute } from "astro";
import { error, formatearErrores, ipDelCliente, json, registrar } from "@/lib/api/http";
import { consumirIntento, faltaSal } from "@/lib/api/limite-tasa";
import { verificarTurnstile } from "@/lib/api/turnstile";
import { construirFila, insertarRespuesta } from "@/lib/db/respuestas";
import { EsquemaEnvio } from "@/lib/validacion/respuesta";

export const prerender = false;

/** Tamaño máximo del cuerpo (bytes). Un envío real pesa ~2 KB. */
export const MAX_BYTES = 32 * 1024;

/**
 * POST /api/respuesta — recibe un cuestionario, lo puntúa en servidor y lo guarda.
 *
 * Orden de comprobaciones:
 *  415 Content-Type distinto de application/json
 *  413 cuerpo mayor de 32 KB
 *  400 JSON inválido o envío que no pasa `EsquemaEnvio` (se devuelven las rutas con error, nunca
 *      el cuerpo recibido)
 *  201 honeypot `hp` relleno: respuesta falsa `{ok:true}` sin guardar
 *  503 `{ok:false, motivo:"configuracion"}` en producción sin RATE_SALT
 *  429 más de 5 envíos por hora por IP (HMAC con sal en KV; la IP no se guarda). Se consume
 *      cuota solo tras pasar la validación, y antes de consultar D1 o Turnstile, para que un
 *      cliente no pueda sondear ids ni gastar verificaciones sin límite.
 *  200 id ya guardado: `{ok:true, duplicado:true}` (reintentos idempotentes)
 *  403 Turnstile inválido
 *  201 `{ok:true, nivel}`; 503 `{ok:false, motivo:"no_guardado"}` si D1 falla
 */
export const POST: APIRoute = async ({ request }) => {
  const inicio = Date.now();
  const responder = (r: Response, evento = "respuesta") => {
    registrar(evento, r.status, inicio);
    return r;
  };

  const tipo = request.headers.get("Content-Type") ?? "";
  if (!/^application\/json\b/i.test(tipo.trim())) {
    return responder(error(415, "content_type"));
  }

  const declarado = Number.parseInt(request.headers.get("Content-Length") ?? "", 10);
  if (Number.isFinite(declarado) && declarado > MAX_BYTES) {
    return responder(error(413, "demasiado_grande"));
  }
  const bytes = await request.arrayBuffer();
  if (bytes.byteLength > MAX_BYTES) return responder(error(413, "demasiado_grande"));

  let crudo: unknown;
  try {
    crudo = JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    return responder(error(400, "json_invalido"));
  }
  if (typeof crudo !== "object" || crudo === null || Array.isArray(crudo)) {
    return responder(error(400, "json_invalido"));
  }

  // Honeypot: un bot que rellena `hp` recibe un "éxito" falso y no se guarda nada.
  const hp = (crudo as Record<string, unknown>).hp;
  if (typeof hp === "string" && hp.length > 0) {
    return responder(json({ ok: true }, 201), "respuesta_honeypot");
  }

  const validacion = EsquemaEnvio.safeParse(crudo);
  if (!validacion.success) {
    const errores = formatearErrores(validacion.error.issues);
    return responder(error(400, "validacion", { errores }));
  }
  const envio = validacion.data;

  let fila: ReturnType<typeof construirFila>;
  try {
    fila = construirFila(envio);
  } catch {
    return responder(error(400, "puntuacion"));
  }

  // Límite de tasa antes de tocar D1 o Turnstile (la cuota ya se consumió con un envío válido).
  if (faltaSal(env.ENTORNO, env.RATE_SALT)) {
    console.error("RATE_SALT no configurado en producción: /api/respuesta deshabilitado");
    return responder(error(503, "configuracion"), "respuesta_configuracion");
  }
  const ip = ipDelCliente(request);
  const limite = await consumirIntento({ kv: env.CACHE, ip, sal: env.RATE_SALT });
  if (!limite.permitido) {
    return responder(error(429, "limite_tasa"), "respuesta_limite");
  }

  // Idempotencia: un reintento del mismo id no vuelve a verificar Turnstile.
  let yaExiste = false;
  try {
    yaExiste =
      (await env.DB.prepare("SELECT 1 AS x FROM respuestas WHERE id = ?").bind(fila.id).first()) !==
      null;
  } catch {
    return responder(error(503, "no_guardado"));
  }
  if (yaExiste) return responder(json({ ok: true, duplicado: true }, 200));

  const humano = await verificarTurnstile({
    secreto: env.TURNSTILE_SECRET,
    entorno: env.ENTORNO,
    token: envio.turnstileToken,
    ip,
    sitio: env.SITE_URL,
  });
  if (!humano) return responder(error(403, "turnstile"));

  try {
    const resultado = await insertarRespuesta(env.DB, fila);
    if (resultado === "duplicada") return responder(json({ ok: true, duplicado: true }, 200));
  } catch {
    return responder(error(503, "no_guardado"), "respuesta_d1");
  }
  return responder(json({ ok: true, nivel: fila.nivel }, 201));
};
