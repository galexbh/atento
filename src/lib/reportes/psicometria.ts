/**
 * Reporte 7: psicometría de ítems (Vanderbilt y Atento) a partir del JSON `items`.
 *
 * Por ítem: n, media, tasa de respaldo (frecuencia >= 2; desempeño >= 4), correlación
 * ítem-total corregida dentro de su subescala, alfa de la subescala y alfa sin el ítem.
 * Comparación Atento vs Vanderbilt por criterio DSM (Pearson entre A01 y V01, etc.) usando
 * solo las respuestas que contienen ambos ítems.
 */
import { listarInstrumentos, obtenerInstrumento } from "../puntuacion/instrumentos";
import type { Escala, Item } from "../puntuacion/tipos";
import { type Db, ESCALAS_TODAS, type FilaItems, leerFilasConItems } from "./comun";
import {
  alfaCronbach,
  alfaSinItem,
  correlacionItemTotalCorregida,
  pearson,
  redondear,
} from "./estadistica";
import type { Filtros } from "./filtros";
import { estaSuprimido } from "./supresion";

export interface PsicometriaItem {
  id: string;
  texto: string;
  escala: Escala;
  fuente: string;
  criterioDSM: string | null;
  n: number;
  suprimido: boolean;
  media: number | null;
  tasaRespaldo: number | null;
  corrItemTotal: number | null;
  alfaSinItem: number | null;
}

export interface PsicometriaEscala {
  instrumento: string;
  escala: Escala;
  n: number;
  k: number;
  alfa: number | null;
}

export interface ParDSM {
  criterioDSM: string;
  itemAtento: string;
  itemVanderbilt: string;
  n: number;
  suprimido: boolean;
  correlacion: number | null;
  mediaAtento: number | null;
  mediaVanderbilt: number | null;
}

export interface ReportePsicometria {
  instrumentos: Array<{ id: string; items: PsicometriaItem[]; escalas: PsicometriaEscala[] }>;
  paresDSM: ParDSM[];
}

function umbralRespaldo(item: Item): number {
  return item.tipo === "desempeno" ? 4 : 2;
}

/** Matriz de casos completos (todas las columnas presentes) para una lista de ítems. */
function matrizCompleta(filas: readonly FilaItems[], ids: readonly string[]): number[][] {
  const salida: number[][] = [];
  for (const f of filas) {
    const fila: number[] = [];
    let completa = true;
    for (const id of ids) {
      const v = f.items[id];
      if (typeof v !== "number") {
        completa = false;
        break;
      }
      fila.push(v);
    }
    if (completa) salida.push(fila);
  }
  return salida;
}

export function calcularPsicometria(filas: readonly FilaItems[]): ReportePsicometria {
  const instrumentos = listarInstrumentos().map((id) => {
    const instrumento = obtenerInstrumento(id);
    const items: PsicometriaItem[] = [];
    const escalas: PsicometriaEscala[] = [];
    for (const escala of ESCALAS_TODAS) {
      const itemsEscala = instrumento.items.filter((i) => i.escala === escala);
      if (itemsEscala.length === 0) continue;
      const ids = itemsEscala.map((i) => i.id);
      const matriz = matrizCompleta(filas, ids);
      const nEscala = matriz.length;
      const supEscala = estaSuprimido(nEscala);
      const alfa = supEscala ? null : alfaCronbach(matriz);
      escalas.push({
        instrumento: id,
        escala,
        n: supEscala ? 0 : nEscala,
        k: ids.length,
        alfa: redondear(alfa, 3),
      });
      itemsEscala.forEach((item, indice) => {
        const valores = filas
          .map((f) => f.items[item.id])
          .filter((v): v is number => typeof v === "number");
        const n = valores.length;
        const suprimido = estaSuprimido(n);
        const suma = valores.reduce((a, b) => a + b, 0);
        const respaldo = valores.filter((v) => v >= umbralRespaldo(item)).length;
        items.push({
          id: item.id,
          texto: item.texto,
          escala,
          fuente: item.fuente,
          criterioDSM: item.criterioDSM ?? null,
          n: suprimido ? 0 : n,
          suprimido,
          media: suprimido ? null : redondear(suma / n, 2),
          tasaRespaldo: suprimido ? null : redondear((respaldo / n) * 100, 1),
          corrItemTotal:
            supEscala || ids.length < 2
              ? null
              : redondear(correlacionItemTotalCorregida(matriz, indice), 3),
          alfaSinItem:
            supEscala || ids.length < 3 ? null : redondear(alfaSinItem(matriz, indice), 3),
        });
      });
    }
    return { id, items, escalas };
  });

  // Pares Atento <-> Vanderbilt por criterio DSM.
  const vanderbilt = obtenerInstrumento("vanderbilt-padres-es-1.0");
  const atento = obtenerInstrumento("atento-0.1");
  const vPorCriterio = new Map(
    vanderbilt.items.filter((i) => i.criterioDSM).map((i) => [i.criterioDSM as string, i]),
  );
  const paresDSM: ParDSM[] = [];
  for (const a of atento.items) {
    if (!a.criterioDSM) continue;
    const v = vPorCriterio.get(a.criterioDSM);
    if (!v) continue;
    const xa: number[] = [];
    const xv: number[] = [];
    for (const f of filas) {
      const va = f.items[a.id];
      const vv = f.items[v.id];
      if (typeof va === "number" && typeof vv === "number") {
        xa.push(va);
        xv.push(vv);
      }
    }
    const n = xa.length;
    const suprimido = estaSuprimido(n);
    paresDSM.push({
      criterioDSM: a.criterioDSM,
      itemAtento: a.id,
      itemVanderbilt: v.id,
      n: suprimido ? 0 : n,
      suprimido,
      correlacion: suprimido ? null : redondear(pearson(xa, xv), 3),
      mediaAtento: suprimido ? null : redondear(xa.reduce((s, x) => s + x, 0) / n, 2),
      mediaVanderbilt: suprimido ? null : redondear(xv.reduce((s, x) => s + x, 0) / n, 2),
    });
  }
  return { instrumentos, paresDSM };
}

export async function reportePsicometria(db: Db, filtros: Filtros): Promise<ReportePsicometria> {
  const filas = await leerFilasConItems(db, filtros);
  return calcularPsicometria(filas);
}
