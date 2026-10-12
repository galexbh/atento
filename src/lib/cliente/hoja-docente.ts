/**
 * Hoja imprimible del docente: resume SUS respuestas sin nivel ni interpretación.
 *
 * - Por escala de síntomas: cuántos ítems marcó "seguido" o "muy seguido" (valor 2 o 3) de
 *   cuántos respondió. No se muestran umbrales ni si la escala "es positiva".
 * - Desempeño: los ítems con "cierta dificultad" (4) o "con dificultad" (5).
 *
 * El servidor sí puntúa y guarda nivel y positividad para investigación (como en la familia), pero
 * eso nunca se muestra al docente. Módulo puro (se prueba en Node).
 */
import { obtenerInstrumento } from "@/lib/puntuacion/instrumentos";
import type { Escala } from "@/lib/puntuacion/tipos";
import type { EscalaHoja, HojaDocente, ItemDesempenoHoja } from "./almacen";

/** Escalas que aparecen en la hoja, en el orden del formulario (las que tienen ítems). */
export const ESCALAS_HOJA: readonly Escala[] = [
  "inatencion",
  "hiperactividad",
  "conducta",
  "ansiedad_depresion",
];

export const NOMBRE_ESCALA_HOJA: Partial<Record<Escala, string>> = {
  inatencion: "Atención",
  hiperactividad: "Actividad e impulsividad",
  conducta: "Oposición y conducta",
  ansiedad_depresion: "Ansiedad o tristeza",
};

export const TEXTO_NO_ES_RESULTADO =
  "Para entregar a la familia o al profesional de salud. No es un diagnóstico ni un resultado.";

export interface EntradaHoja {
  instrumentoId: string;
  respuestas: Record<string, number>;
  edadAnios: number;
  codigoVinculo: string | null;
  investigacion: boolean;
  guardado: boolean;
  fecha?: string;
}

export function construirHojaDocente(entrada: EntradaHoja): HojaDocente {
  const instrumento = obtenerInstrumento(entrada.instrumentoId);
  const escalas: EscalaHoja[] = ESCALAS_HOJA.map((escala) => {
    const items = instrumento.items.filter((i) => i.escala === escala);
    let marcados = 0;
    let respondidos = 0;
    for (const item of items) {
      const v = entrada.respuestas[item.id];
      if (typeof v !== "number") continue;
      respondidos += 1;
      if (v >= 2) marcados += 1;
    }
    return { escala, marcados, respondidos, total: items.length };
  });
  const itemsDesempeno = instrumento.items.filter((i) => i.tipo === "desempeno");
  const etiquetas = new Map(instrumento.opcionesDesempeno.map((o) => [o.valor, o.etiqueta]));
  const desempenoConDificultad: ItemDesempenoHoja[] = [];
  let desempenoRespondidos = 0;
  for (const item of itemsDesempeno) {
    const v = entrada.respuestas[item.id];
    if (typeof v !== "number") continue;
    desempenoRespondidos += 1;
    if (v >= 4) {
      desempenoConDificultad.push({
        id: item.id,
        numero: item.orden,
        texto: item.texto,
        valor: v,
        etiqueta: etiquetas.get(v as 4 | 5) ?? String(v),
      });
    }
  }
  return {
    instrumentoId: instrumento.id,
    fecha: entrada.fecha ?? new Date().toISOString(),
    edadAnios: entrada.edadAnios,
    codigoVinculo: entrada.codigoVinculo,
    escalas,
    desempenoConDificultad,
    desempenoRespondidos,
    desempenoTotal: itemsDesempeno.length,
    investigacion: entrada.investigacion,
    guardado: entrada.guardado,
  };
}
