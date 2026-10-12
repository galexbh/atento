/**
 * Puntuación determinista de un cuestionario de cribado.
 *
 * Reglas de Vanderbilt (informante de padres, 1ª ed.):
 * - Un ítem de frecuencia "cuenta" si su valor es 2 o 3.
 * - Inatención positiva: ≥ 6 ítems que cuentan (de 9).
 * - Hiperactividad/impulsividad positiva: ≥ 6 de 9.
 * - Oposición desafiante: ≥ 4 de 8.
 * - Conducta: ≥ 3 de 14.
 * - Ansiedad/depresión: ≥ 3 de 7.
 * - Desempeño positivo: ≥ 1 ítem de desempeño con valor 4 o 5.
 *
 * Reglas de Vanderbilt (informante docente, 1ª ed., guía de puntuación de NICHQ):
 * - Inatención ≥ 6 de 9 (ítems 1–9); hiperactividad/impulsividad ≥ 6 de 9 (10–18).
 * - Oposición desafiante/conducta (escala combinada, ítems 19–28): ≥ 3 de 10. En Atento se guarda
 *   en la escala `conducta`; `oposicion` no tiene ítems y nunca es positiva.
 * - Ansiedad/depresión ≥ 3 de 7 (29–35). Desempeño ≥ 1 ítem con 4 o 5 (36–43).
 *
 * Los umbrales se leen de `REGLAS[instrumentoId]` para poder añadir otros
 * instrumentos sin tocar el algoritmo.
 *
 * IMPORTANTE: esto es cribado comunitario, no diagnóstico. El "nivel" es
 * una regla propia de Atento (ver `calcularNivel`) pendiente de revisión
 * clínica.
 */
import { indexarItems, obtenerInstrumento } from "./instrumentos";
import type {
  EntradaPuntuacion,
  Escala,
  EscalaAlerta,
  Nivel,
  Resultado,
  ResultadoEscala,
  TipoItem,
} from "./tipos";

/** Todas las escalas, en orden canónico. */
export const ESCALAS: readonly Escala[] = [
  "inatencion",
  "hiperactividad",
  "oposicion",
  "conducta",
  "ansiedad_depresion",
  "desempeno",
];

/** Escalas que, si son positivas, generan una alerta de comorbilidad. */
const ESCALAS_ALERTA: readonly EscalaAlerta[] = ["oposicion", "conducta", "ansiedad_depresion"];

export interface ReglasInstrumento {
  /** Mínimo de ítems que cumplen criterio para que la escala sea positiva. */
  umbrales: Record<Escala, number>;
  /** Valor mínimo de un ítem de frecuencia para contar como criterio. */
  minimoCriterioFrecuencia: number;
  /** Valor mínimo de un ítem de desempeño para contar como criterio. */
  minimoCriterioDesempeno: number;
  /** Proporción máxima de ítems faltantes por escala (exclusivo) para poder ser positiva. */
  maxProporcionFaltantes: number;
}

const REGLAS_VANDERBILT: ReglasInstrumento = {
  umbrales: {
    inatencion: 6,
    hiperactividad: 6,
    oposicion: 4,
    conducta: 3,
    ansiedad_depresion: 3,
    desempeno: 1,
  },
  minimoCriterioFrecuencia: 2,
  minimoCriterioDesempeno: 4,
  maxProporcionFaltantes: 0.2,
};

/**
 * Vanderbilt docente 1ª ed.: mismos cortes salvo `conducta`, que aquí es la escala combinada de
 * oposición/conducta (≥ 3 de 10). `oposicion` conserva un umbral nominal, pero al no tener ítems
 * (total 0) nunca puede ser positiva.
 */
const REGLAS_VANDERBILT_DOCENTE: ReglasInstrumento = {
  ...REGLAS_VANDERBILT,
  umbrales: { ...REGLAS_VANDERBILT.umbrales, conducta: 3 },
};

/** Reglas por instrumento. Atento 0.1 copia provisionalmente las de Vanderbilt. */
export const REGLAS: Record<string, ReglasInstrumento> = {
  "vanderbilt-padres-es-1.0": REGLAS_VANDERBILT,
  "atento-0.1": { ...REGLAS_VANDERBILT, umbrales: { ...REGLAS_VANDERBILT.umbrales } },
  "vanderbilt-docente-es-1.0": REGLAS_VANDERBILT_DOCENTE,
};

/** Rango válido de valores por tipo de ítem. */
export const RANGO_VALOR: Record<TipoItem, { min: number; max: number }> = {
  frecuencia: { min: 0, max: 3 },
  desempeno: { min: 1, max: 5 },
};

/**
 * Obtiene las reglas de un instrumento.
 * @throws Error si el instrumento no tiene reglas registradas.
 */
export function obtenerReglas(instrumentoId: string): ReglasInstrumento {
  const reglas = REGLAS[instrumentoId];
  if (!reglas) {
    throw new Error(`No hay reglas de puntuación para "${instrumentoId}"`);
  }
  return reglas;
}

/**
 * Nivel de riesgo (regla propia de Atento, pendiente de revisión clínica).
 *
 * - alto: (inatención o hiperactividad positiva) y desempeño positivo.
 * - moderado: (inatención o hiperactividad positiva) sin desempeño positivo;
 *   o bien una de esas escalas "casi positiva" (positivosCriterio entre
 *   umbral−2 y umbral−1, es decir 4–5 de 9 en Vanderbilt) y desempeño positivo.
 * - bajo: todo lo demás.
 *
 * Nota: una escala con >20 % de ítems faltantes nunca es positiva, pero sí
 * puede contar como "casi positiva" por sus ítems respondidos.
 */
export function calcularNivel(escalas: Record<Escala, ResultadoEscala>): Nivel {
  const nucleo = [escalas.inatencion, escalas.hiperactividad];
  const sintomasPositivos = nucleo.some((e) => e.positivo);
  const desempenoPositivo = escalas.desempeno.positivo;
  const casiPositiva = nucleo.some(
    (e) => e.positivosCriterio >= e.umbral - 2 && e.positivosCriterio < e.umbral,
  );

  if (sintomasPositivos && desempenoPositivo) return "alto";
  if (sintomasPositivos) return "moderado";
  if (casiPositiva && desempenoPositivo) return "moderado";
  return "bajo";
}

function validarValor(itemId: string, tipo: TipoItem, valor: unknown): number {
  const rango = RANGO_VALOR[tipo];
  if (typeof valor !== "number" || !Number.isInteger(valor)) {
    throw new Error(
      `Valor inválido para el ítem ${itemId}: se esperaba un entero, se recibió ${String(valor)}`,
    );
  }
  if (valor < rango.min || valor > rango.max) {
    throw new Error(
      `Valor fuera de rango para el ítem ${itemId} (${tipo}): ${valor}; el rango válido es ${rango.min}–${rango.max}`,
    );
  }
  return valor;
}

/**
 * Puntúa las respuestas de un instrumento.
 *
 * - Ítems sin respuesta no fallan: se listan en `itemsFaltantes` y se
 *   cuentan solo los respondidos. Si faltan más del 20 % de una escala,
 *   esa escala se marca `positivo = false`.
 * - Valores fuera de rango, no enteros, o ids de ítems que no pertenecen
 *   al instrumento lanzan `Error` con un mensaje claro.
 */
export function puntuar(entrada: EntradaPuntuacion): Resultado {
  const instrumento = obtenerInstrumento(entrada.instrumentoId);
  const reglas = obtenerReglas(entrada.instrumentoId);
  const items = indexarItems(instrumento);

  for (const id of Object.keys(entrada.respuestas)) {
    if (!items.has(id)) {
      throw new Error(`El ítem "${id}" no pertenece al instrumento "${instrumento.id}"`);
    }
  }

  const itemsFaltantes: string[] = [];
  const acumulado = new Map<Escala, ResultadoEscala>();
  for (const escala of ESCALAS) {
    acumulado.set(escala, {
      escala,
      respondidos: 0,
      total: 0,
      puntaje: 0,
      positivosCriterio: 0,
      umbral: reglas.umbrales[escala],
      positivo: false,
    });
  }

  for (const item of instrumento.items) {
    const acum = acumulado.get(item.escala);
    if (!acum) continue;
    acum.total += 1;

    const bruto = entrada.respuestas[item.id];
    if (bruto === undefined || bruto === null) {
      itemsFaltantes.push(item.id);
      continue;
    }
    const valor = validarValor(item.id, item.tipo, bruto);
    acum.respondidos += 1;
    acum.puntaje += valor;

    const minimo =
      item.tipo === "desempeno" ? reglas.minimoCriterioDesempeno : reglas.minimoCriterioFrecuencia;
    if (valor >= minimo) acum.positivosCriterio += 1;
  }

  const escalas = {} as Record<Escala, ResultadoEscala>;
  for (const escala of ESCALAS) {
    const r = acumulado.get(escala) as ResultadoEscala;
    const faltantes = r.total - r.respondidos;
    const demasiadosFaltantes =
      r.total === 0 || faltantes / r.total > reglas.maxProporcionFaltantes;
    r.positivo = !demasiadosFaltantes && r.positivosCriterio >= r.umbral;
    escalas[escala] = r;
  }

  const combinado = escalas.inatencion.positivo && escalas.hiperactividad.positivo;
  const alertas = ESCALAS_ALERTA.filter((e) => escalas[e].positivo);

  return {
    instrumentoId: instrumento.id,
    escalas,
    combinado,
    nivel: calcularNivel(escalas),
    alertas,
    itemsFaltantes,
  };
}
