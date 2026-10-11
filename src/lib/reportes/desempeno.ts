/** Reporte 6: desempeño. Distribución de los ítems 1-5 y relación con positividad de síntomas. */
import { obtenerInstrumento } from "../puntuacion/instrumentos";
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
  const vanderbilt = obtenerInstrumento("vanderbilt-padres-es-1.0");
  const itemsDesempeno = vanderbilt.items.filter((i) => i.tipo === "desempeno");
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
