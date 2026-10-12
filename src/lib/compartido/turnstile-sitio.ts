/**
 * Clave de sitio de Turnstile (es pública; el secreto vive solo en el Worker como TURNSTILE_SECRET).
 * La usan los dos cuestionarios (familia y docente) con la misma acción `envio-respuesta`.
 *
 * - Build de producción o preview: widget "atento.galexbh.dev (Spin)", dominios atento.galexbh.dev,
 *   atento-preview.galexbh.dev, localhost y 127.0.0.1.
 * - `astro dev`: clave de pruebas de Cloudflare "1x00000000000000000000AA" (siempre pasa).
 * `PUBLIC_TURNSTILE_SITE_KEY` permite sustituirla sin tocar el código.
 */
export const CLAVE_SITIO_PRODUCCION = "0x4AAAAAAFUM2SiQtialMd1m";
export const CLAVE_SITIO_PRUEBAS = "1x00000000000000000000AA";

export function claveSitioTurnstile(): string {
  return (
    import.meta.env.PUBLIC_TURNSTILE_SITE_KEY ||
    (import.meta.env.PROD ? CLAVE_SITIO_PRODUCCION : CLAVE_SITIO_PRUEBAS)
  );
}
