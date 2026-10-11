/**
 * Orden de presentación del cuestionario público: Vanderbilt (54) + Atento 0.1 (18) = 72 ítems.
 *
 * Estrategia de intercalado (documentada aquí y en el reporte):
 * - Los ítems Vanderbilt de frecuencia (V01–V47) se presentan en su orden original.
 * - Tras cada bloque de 3 ítems Vanderbilt de frecuencia se intercala 1 ítem Atento (A01…):
 *   V01 V02 V03 A01 V04 V05 V06 A02 … hasta V45/A15 (15 bloques completos).
 * - V46 y V47 cierran la sección de frecuencia y los 3 ítems Atento restantes (A16–A18) van
 *   justo después, antes del bloque de desempeño.
 * - Los 7 ítems de desempeño (V48–V54, escala 1–5) quedan al final sin mezclar, porque usan
 *   otras opciones de respuesta y conviene no alternar escalas.
 * - Páginas de 6 ítems → 12 páginas. Los ítems Atento no se marcan visualmente; el usuario los
 *   percibe como parte del mismo cuestionario ("preguntas adicionales de Atento" solo en
 *   metodología). Internamente llevan `fuente: "atento"`.
 *
 * Este módulo se usa tanto en build (Astro) como en el navegador: es puro.
 */
import { obtenerInstrumento } from "@/lib/puntuacion/instrumentos";
import type { Item } from "@/lib/puntuacion/tipos";

export const INSTRUMENTO_ATENTO = "atento-0.1";
export const ITEMS_POR_PAGINA = 6;

export interface ItemOrdenado {
  item: Item;
  /** Id del instrumento al que pertenece el ítem. */
  instrumentoId: string;
  /** Posición 1-based en la presentación. */
  posicion: number;
  /** Página 0-based. */
  pagina: number;
}

export function ordenarItems(instrumentoPrincipal: string): ItemOrdenado[] {
  const principal = obtenerInstrumento(instrumentoPrincipal);
  const atento = obtenerInstrumento(INSTRUMENTO_ATENTO);
  const frecuencia = principal.items.filter((i) => i.tipo === "frecuencia");
  const desempeno = principal.items.filter((i) => i.tipo === "desempeno");
  const extra = [...atento.items];

  const secuencia: { item: Item; instrumentoId: string }[] = [];
  let bloque = 0;
  for (const item of frecuencia) {
    secuencia.push({ item, instrumentoId: principal.id });
    bloque += 1;
    if (bloque === 3 && extra.length) {
      secuencia.push({ item: extra.shift() as Item, instrumentoId: atento.id });
      bloque = 0;
    }
  }
  for (const item of extra) secuencia.push({ item, instrumentoId: atento.id });
  for (const item of desempeno) secuencia.push({ item, instrumentoId: principal.id });

  return secuencia.map((s, i) => ({
    ...s,
    posicion: i + 1,
    pagina: Math.floor(i / ITEMS_POR_PAGINA),
  }));
}

export function totalPaginas(items: ItemOrdenado[]): number {
  return Math.ceil(items.length / ITEMS_POR_PAGINA);
}
