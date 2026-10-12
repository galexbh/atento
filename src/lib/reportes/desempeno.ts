/**
 * Reporte 6: desempeño. Distribución de los ítems 1-5 y relación con positividad de síntomas.
 *
 * Con el filtro `versionInstrumento` se muestran los ítems de desempeño de ese instrumento
 * (V48–V54 de padres o T36–T43 del docente); sin filtro, los de ambos (ids distintos).
 */
import {
  INSTRUMENTO_ACTUAL,
  INSTRUMENTO_DOCENTE,
  listarInstrumentos,
  obtenerInstrumento,
} from "../puntuacion/instrumentos";
import type { Item } from "../puntuacion/tipos";
import { type Db, leerFilasConItems } from "./comun";
import { redondear } from "./estadistica";
import type { Filtros } from "./filtros";
import { type Celda, conteo, type Proporcion, proporcion } from "./supresion";

export interface ItemDesempeno {
  id: string;
  texto: string;
  n: number;
  suprimido: boolean;
  media: number | null;
  /** distribucion[valor 1..5] */
  distribucion: Record<number, Celda>;
  /** % con problemas (4 o 5). */
  conProblemas: Proporcion;
}

export interface ReporteDesempeno {
  items: ItemDesempeno[];
  /** Relación: % con desempeño positivo entre quienes tienen síntomas positivos vs. no. */
  relacion: { conSintomas: Proporcion; sinSintomas: Proporcion };
}

export async function reporteDesempeno(db: Db, filtros: Filtros): Promise<ReporteDesempeno> {
  const filas = await leerFilasConItems(db, filtros);
  const itemsDesempeno = itemsDesempenoPara(filtros.versionInstrumento);
  const items = itemsDesempeno.map((item): ItemDesempeno => {
    const valores = filas
      .map((f) => f.items[item.id])
      .filter((v): v is number => typeof v === "number" && v >= 1 && v <= 5);
    const distribucion: Record<number, Celda> = {};
    for (let v = 1; v <= 5; v++) distribucion[v] = conteo(valores.filter((x) => x === v).length);
    const problemas = valores.filter((v) => v >= 4).length;
    const celda = conteo(valores.length);
    const suma = valores.reduce((a, b) => a + b, 0);
    return {
      id: item.id,
      texto: item.texto,
      n: celda.n,
      suprimido: celda.suprimido,
      media: celda.suprimido ? null : redondear(suma / valores.length, 2),
      distribucion,
      conProblemas: proporcion(problemas, valores.length),
    };
  });
  let conSintomas = 0;
  let conSintomasDesemp = 0;
  let sinSintomas = 0;
  let sinSintomasDesemp = 0;
  for (const f of filas) {
    const desempPositivo = itemsDesempeno.some((i) => (f.items[i.id] ?? 0) >= 4);
    const sintomas = f.pos_inatencion === 1 || f.pos_hiperactividad === 1;
    if (sintomas) {
      conSintomas++;
      if (desempPositivo) conSintomasDesemp++;
    } else {
      sinSintomas++;
      if (desempPositivo) sinSintomasDesemp++;
    }
  }
  return {
    items,
    relacion: {
      conSintomas: proporcion(conSintomasDesemp, conSintomas),
      sinSintomas: proporcion(sinSintomasDesemp, sinSintomas),
    },
  };
}

/** Ítems de desempeño a mostrar según el filtro de instrumento. */
export function itemsDesempenoPara(versionInstrumento?: string): Item[] {
  const ids =
    versionInstrumento && listarInstrumentos().includes(versionInstrumento)
      ? [versionInstrumento]
      : [INSTRUMENTO_ACTUAL, INSTRUMENTO_DOCENTE];
  return ids.flatMap((id) => obtenerInstrumento(id).items.filter((i) => i.tipo === "desempeno"));
}
