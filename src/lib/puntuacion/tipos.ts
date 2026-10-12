/**
 * Tipos del dominio de instrumentos y puntuación de Atento.
 *
 * Atento es un sitio comunitario de cribado (no diagnóstico) de TDAH infantil.
 * Nada de lo que se calcula aquí constituye un diagnóstico.
 */

/** Escalas (subescalas) que agrupan ítems. */
export type Escala =
  | "inatencion"
  | "hiperactividad"
  | "oposicion"
  | "conducta"
  | "ansiedad_depresion"
  | "desempeno";

/** Origen de la redacción del ítem. */
export type Fuente = "vanderbilt" | "atento";

/** Tipo de respuesta que admite un ítem. */
export type TipoItem = "frecuencia" | "desempeno";

export interface Item {
  /** Identificador estable, p. ej. "V01" o "A01". */
  id: string;
  /** Posición de presentación (1-based). */
  orden: number;
  /** Enunciado que se muestra al informante. */
  texto: string;
  /** Ejemplo concreto para facilitar la comprensión (opcional). */
  ejemplo?: string;
  escala: Escala;
  fuente: Fuente;
  /** Criterio DSM-5 al que corresponde (A1a–A1i, A2a–A2i), si aplica. */
  criterioDSM?: string;
  /** "frecuencia" usa 0–3; "desempeno" usa 1–5. */
  tipo: TipoItem;
}

export interface OpcionFrecuencia {
  valor: 0 | 1 | 2 | 3;
  etiqueta: string;
}

export interface OpcionDesempeno {
  valor: 1 | 2 | 3 | 4 | 5;
  etiqueta: string;
}

export interface Instrumento {
  id: string;
  nombre: string;
  version: string;
  /** Fecha ISO (AAAA-MM-DD) de la versión del instrumento en este repositorio. */
  fecha: string;
  informante: "padres" | "docente";
  creditos: string;
  opcionesFrecuencia: OpcionFrecuencia[];
  opcionesDesempeno: OpcionDesempeno[];
  items: Item[];
  /** URL del documento del que se tomó el texto (si aplica). */
  fuenteUrl?: string;
  /** Notas de edición y trazabilidad. */
  notas?: string[];
  /** Verdadero si la redacción es provisional y requiere revisión clínica. */
  traduccionProvisional?: boolean;
}

/** Resultado de una escala tras puntuar. */
export interface ResultadoEscala {
  escala: Escala;
  /** Ítems de la escala con respuesta válida. */
  respondidos: number;
  /** Ítems totales de la escala en el instrumento. */
  total: number;
  /** Suma de los valores respondidos. */
  puntaje: number;
  /** Ítems que cumplen el criterio (frecuencia ≥ 2, o desempeño ≥ 4). */
  positivosCriterio: number;
  /** Mínimo de positivosCriterio para que la escala sea positiva. */
  umbral: number;
  /** Falso si faltan demasiados ítems (ver `escalaCompleta`) o la escala no tiene ítems. */
  completa: boolean;
  /** Verdadero si la escala está completa y positivosCriterio ≥ umbral. */
  positivo: boolean;
}

export type Nivel = "bajo" | "moderado" | "alto";

export type EscalaAlerta = "conducta" | "ansiedad_depresion" | "oposicion";

export interface Resultado {
  instrumentoId: string;
  escalas: Record<Escala, ResultadoEscala>;
  /** Inatención e hiperactividad positivas a la vez. */
  combinado: boolean;
  nivel: Nivel;
  alertas: EscalaAlerta[];
  /** Ids de ítems del instrumento sin respuesta. */
  itemsFaltantes: string[];
  /** Escalas con ítems que quedaron incompletas por faltantes. */
  escalasIncompletas: Escala[];
  /** Falso si inatención e hiperactividad están incompletas: no se entrega nivel. */
  nivelEntregable: boolean;
}

export interface EntradaPuntuacion {
  instrumentoId: string;
  /** itemId → valor. */
  respuestas: Record<string, number>;
}
