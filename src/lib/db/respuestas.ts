/**
 * Acceso a la tabla `respuestas`: construcción de la fila desde un envío validado y puntuado,
 * e inserción con parámetros ligados.
 */
import { puntuar } from "../puntuacion/puntuar";
import type { Nivel } from "../puntuacion/tipos";
import type { Envio } from "../validacion/respuesta";

/** Fila de `respuestas` tal como se inserta (ver migrations/0001). */
export interface FilaRespuestaNueva {
  id: string;
  creado_en: string;
  periodo_anio: number;
  departamento: string;
  municipio: string;
  edad_anios: number;
  sexo: string;
  informante: string;
  items: string;
  punt_inatencion: number;
  punt_hiperactividad: number;
  punt_oposicion: number;
  punt_conducta: number;
  punt_ansiedad_depresion: number;
  punt_desempeno: number;
  pos_inatencion: 0 | 1;
  pos_hiperactividad: 0 | 1;
  pos_oposicion: 0 | 1;
  pos_conducta: 0 | 1;
  pos_ansiedad_depresion: 0 | 1;
  pos_desempeno: 0 | 1;
  nivel: Nivel;
  consentimiento_investigacion: 0 | 1;
  version_consentimiento: string;
  version_instrumento: string;
  duracion_segundos: number | null;
  completado: 0 | 1;
  item_abandono: string | null;
  codigo_vinculo: string | null;
}

export const COLUMNAS_RESPUESTA: readonly (keyof FilaRespuestaNueva)[] = [
  "id",
  "creado_en",
  "periodo_anio",
  "departamento",
  "municipio",
  "edad_anios",
  "sexo",
  "informante",
  "items",
  "punt_inatencion",
  "punt_hiperactividad",
  "punt_oposicion",
  "punt_conducta",
  "punt_ansiedad_depresion",
  "punt_desempeno",
  "pos_inatencion",
  "pos_hiperactividad",
  "pos_oposicion",
  "pos_conducta",
  "pos_ansiedad_depresion",
  "pos_desempeno",
  "nivel",
  "consentimiento_investigacion",
  "version_consentimiento",
  "version_instrumento",
  "duracion_segundos",
  "completado",
  "item_abandono",
  "codigo_vinculo",
];

export const SQL_INSERTAR_RESPUESTA = `INSERT INTO respuestas (${COLUMNAS_RESPUESTA.join(", ")}) VALUES (${COLUMNAS_RESPUESTA.map(() => "?").join(", ")})`;

const bit = (v: boolean): 0 | 1 => (v ? 1 : 0);

/** Redondea la duración a múltiplos de 10 s (menos granularidad, menos identificabilidad). */
export function redondearDuracion(segundos: number | undefined): number | null {
  if (segundos === undefined) return null;
  return Math.round(segundos / 10) * 10;
}

/**
 * Serializa los ítems guardados: las respuestas del instrumento principal como mapa plano
 * (itemId -> valor) y, si el envío trae `respuestasAtento` (ítems A01–A18 de atento-0.1),
 * se anidan bajo la clave `atento`.
 */
export function serializarItems(envio: Envio): string {
  const extra = (envio as unknown as { respuestasAtento?: Record<string, number> })
    .respuestasAtento;
  const items: Record<string, unknown> = { ...envio.respuestas };
  if (extra && Object.keys(extra).length > 0) items.atento = extra;
  return JSON.stringify(items);
}

/** Puntúa en servidor y construye la fila. `creado_en` es la fecha UTC sin hora. */
export function construirFila(envio: Envio, ahora: Date = new Date()): FilaRespuestaNueva {
  const r = puntuar({ instrumentoId: envio.instrumentoId, respuestas: envio.respuestas });
  const fecha = ahora.toISOString().slice(0, 10);
  const e = r.escalas;
  return {
    id: envio.id.toLowerCase(),
    creado_en: fecha,
    periodo_anio: Number.parseInt(fecha.slice(0, 4), 10),
    departamento: envio.departamento,
    municipio: envio.municipio,
    edad_anios: envio.edadAnios,
    sexo: envio.sexo,
    informante: envio.informante,
    items: serializarItems(envio),
    punt_inatencion: e.inatencion.puntaje,
    punt_hiperactividad: e.hiperactividad.puntaje,
    punt_oposicion: e.oposicion.puntaje,
    punt_conducta: e.conducta.puntaje,
    punt_ansiedad_depresion: e.ansiedad_depresion.puntaje,
    punt_desempeno: e.desempeno.puntaje,
    pos_inatencion: bit(e.inatencion.positivo),
    pos_hiperactividad: bit(e.hiperactividad.positivo),
    pos_oposicion: bit(e.oposicion.positivo),
    pos_conducta: bit(e.conducta.positivo),
    pos_ansiedad_depresion: bit(e.ansiedad_depresion.positivo),
    pos_desempeno: bit(e.desempeno.positivo),
    nivel: r.nivel,
    consentimiento_investigacion: bit(envio.consentimientoInvestigacion),
    version_consentimiento: envio.versionConsentimiento,
    version_instrumento: envio.instrumentoId,
    duracion_segundos: redondearDuracion(envio.duracionSegundos),
    completado: bit(envio.completado),
    item_abandono: envio.itemAbandono ?? null,
    codigo_vinculo: envio.codigoVinculo ?? null,
  };
}

export function parametrosRespuesta(fila: FilaRespuestaNueva): (string | number | null)[] {
  return COLUMNAS_RESPUESTA.map((c) => fila[c]);
}

export type ResultadoInsercion = "insertada" | "duplicada";

/** Inserta la fila; si el id ya existe devuelve "duplicada" sin modificar nada. */
export async function insertarRespuesta(
  db: D1Database,
  fila: FilaRespuestaNueva,
): Promise<ResultadoInsercion> {
  const existe = await db
    .prepare("SELECT 1 AS x FROM respuestas WHERE id = ?")
    .bind(fila.id)
    .first();
  if (existe) return "duplicada";
  try {
    await db
      .prepare(SQL_INSERTAR_RESPUESTA)
      .bind(...parametrosRespuesta(fila))
      .run();
    return "insertada";
  } catch (e) {
    if (e instanceof Error && /UNIQUE constraint failed/i.test(e.message)) return "duplicada";
    throw e;
  }
}
