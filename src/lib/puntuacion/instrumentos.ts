/**
 * Registro de instrumentos disponibles.
 *
 * Los instrumentos viven como JSON en `src/data/instrumento/` y se
 * exponen aquí tipados. Para añadir uno nuevo: crear el JSON, importarlo
 * y agregarlo a `INSTRUMENTOS`; después añadir sus reglas en
 * `REGLAS` (puntuar.ts).
 */
import atento from "../../data/instrumento/atento-0.1.json";
import vanderbiltDocente from "../../data/instrumento/vanderbilt-docente-es-1.0.json";
import vanderbilt from "../../data/instrumento/vanderbilt-padres-es-1.0.json";
import type { Instrumento, Item } from "./tipos";

/** Instrumento que usa el sitio por defecto. */
export const INSTRUMENTO_ACTUAL = "vanderbilt-padres-es-1.0";

/** Instrumento de la versión docente (flujo /docente). */
export const INSTRUMENTO_DOCENTE = "vanderbilt-docente-es-1.0";

const INSTRUMENTOS: readonly Instrumento[] = [
  vanderbilt as Instrumento,
  atento as Instrumento,
  vanderbiltDocente as Instrumento,
];

const POR_ID: ReadonlyMap<string, Instrumento> = new Map(INSTRUMENTOS.map((i) => [i.id, i]));

/** Ids de todos los instrumentos registrados. */
export function listarInstrumentos(): string[] {
  return INSTRUMENTOS.map((i) => i.id);
}

/**
 * Devuelve el instrumento por id.
 * @throws Error si el id no está registrado.
 */
export function obtenerInstrumento(id: string): Instrumento {
  const instrumento = POR_ID.get(id);
  if (!instrumento) {
    throw new Error(
      `Instrumento desconocido: "${id}". Disponibles: ${listarInstrumentos().join(", ")}`,
    );
  }
  return instrumento;
}

/** Índice itemId → Item de un instrumento. */
export function indexarItems(instrumento: Instrumento): Map<string, Item> {
  return new Map(instrumento.items.map((item) => [item.id, item]));
}

/**
 * Instrumentos cuyas respuestas NO entran en la publicación pública (/datos, /api/publico/*) ni
 * en la versión "todas" de `agregados_municipio`: el informante docente describe al mismo niño que
 * ya pudo contar su familia, así que sumarlo contaría dos veces al mismo niño. El panel admin sí
 * las ve (filtrando por `version_instrumento`).
 */
export const INSTRUMENTOS_FUERA_DEL_MAPA: readonly string[] = INSTRUMENTOS.filter(
  (i) => i.informante === "docente",
).map((i) => i.id);

/** Verdadero si las respuestas de ese instrumento cuentan en el mapa público. */
export function cuentaEnMapa(versionInstrumento: string): boolean {
  return !INSTRUMENTOS_FUERA_DEL_MAPA.includes(versionInstrumento);
}
