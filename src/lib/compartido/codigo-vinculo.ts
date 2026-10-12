/**
 * Código de vínculo familia–docente (8 caracteres alfanuméricos).
 *
 * Lo genera el navegador de la familia al terminar (`generarCodigoVinculo` en
 * `lib/cliente/almacen.ts`) y lo comparte con el docente en el enlace
 * `/docente?codigo=XXXXXXXX`. No se deriva de ningún dato y el servidor no tiene ningún endpoint
 * que devuelva respuestas a partir de él: solo sirve para emparejar filas en el panel de
 * investigación (reporte de concordancia) y para pedir el borrado de una respuesta.
 *
 * Módulo puro: se usa en el navegador, en el Worker y en pruebas.
 */

/** Formato aceptado por el servidor (ver `EsquemaEnvio`). */
export const CODIGO_VINCULO_RE = /^[A-Za-z0-9]{8}$/;

/**
 * Normaliza lo que escribe o pega una persona: quita espacios, guiones (incluidos los
 * tipográficos) y puntos, y pasa a mayúsculas. "abcd-1234" → "ABCD1234".
 */
export function normalizarCodigoVinculo(entrada: string | null | undefined): string {
  return (entrada ?? "").replace(/[\s.\-‐-―−_]/g, "").toUpperCase();
}

/** Verdadero si, ya normalizado, el código tiene exactamente 8 caracteres A–Z/0–9. */
export function esCodigoVinculoValido(codigo: string): boolean {
  return /^[A-Z0-9]{8}$/.test(codigo);
}

/**
 * Normaliza y valida en un paso: devuelve el código normalizado o `null` si queda vacío o no
 * tiene el formato correcto.
 */
export function leerCodigoVinculo(entrada: string | null | undefined): string | null {
  const codigo = normalizarCodigoVinculo(entrada);
  return esCodigoVinculoValido(codigo) ? codigo : null;
}

/** Formato legible del código: XXXX-XXXX. */
export function formatearCodigo(codigo: string): string {
  return `${codigo.slice(0, 4)}-${codigo.slice(4)}`;
}
