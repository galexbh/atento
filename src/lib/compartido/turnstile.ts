/**
 * Constantes de Turnstile compartidas entre el navegador y el Worker.
 *
 * `ACCION_ENVIO` se envía como `action` al renderizar el widget y el servidor exige que siteverify
 * devuelva exactamente ese valor: un token emitido para otra superficie no sirve aquí.
 */
export const ACCION_ENVIO = "envio-respuesta";

/** Longitud máxima de un token de Turnstile según la documentación de Cloudflare. */
export const LONGITUD_MAXIMA_TOKEN = 2048;
