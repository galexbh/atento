/** Reporte 3: demografía. Edad x sexo, informante y tasas de positivo por edad y sexo. */
import { consultar, type Db, SQL_POSITIVO, where } from "./comun";
import { type Filtros, INFORMANTES, SEXOS } from "./filtros";
import { type Celda, conteo, type Proporcion, proporcion } from "./supresion";

export interface ReporteDemografia {
  edades: number[];
  sexos: string[];
  /** celdas[edad][sexo] */
  edadPorSexo: Record<string, Record<string, Celda>>;
  porEdad: Array<{ edad: number; n: Celda; positivo: Proporcion }>;
  porSexo: Array<{ sexo: string; n: Celda; positivo: Proporcion }>;
  porInformante: Array<{ informante: string; n: Celda; positivo: Proporcion }>;
  /** Razón M:F entre positivos (null si alguna celda está suprimida). */
  razonMF: number | null;
}

interface FilaCruce {
  edad: number;
  sexo: string | null;
  n: number;
  positivos: number;
}

export async function reporteDemografia(db: Db, filtros: Filtros): Promise<ReporteDemografia> {
  const w = where(filtros);
  const [cruce, informantes] = await Promise.all([
    consultar<FilaCruce>(
      db,
      `SELECT edad_anios AS edad, sexo, COUNT(*) AS n,
         SUM(CASE WHEN ${SQL_POSITIVO} THEN 1 ELSE 0 END) AS positivos
       FROM respuestas ${w.sql} GROUP BY edad_anios, sexo`,
      w.params,
    ),
    consultar<{ informante: string | null; n: number; positivos: number }>(
      db,
      `SELECT informante, COUNT(*) AS n,
         SUM(CASE WHEN ${SQL_POSITIVO} THEN 1 ELSE 0 END) AS positivos
       FROM respuestas ${w.sql} GROUP BY informante`,
      w.params,
    ),
  ]);
  const edades = [6, 7, 8, 9, 10, 11, 12];
  const sexos = [...SEXOS];
  const edadPorSexo: Record<string, Record<string, Celda>> = {};
  const acumEdad = new Map<number, { n: number; p: number }>();
  const acumSexo = new Map<string, { n: number; p: number }>();
  for (const e of edades) {
    edadPorSexo[e] = {};
    for (const s of sexos) edadPorSexo[e][s] = conteo(0);
  }
  for (const f of cruce) {
    const sexo = f.sexo ?? "X";
    const fila = edadPorSexo[f.edad];
    if (fila) fila[sexo] = conteo(f.n);
    const ae = acumEdad.get(f.edad) ?? { n: 0, p: 0 };
    acumEdad.set(f.edad, { n: ae.n + f.n, p: ae.p + f.positivos });
    const as = acumSexo.get(sexo) ?? { n: 0, p: 0 };
    acumSexo.set(sexo, { n: as.n + f.n, p: as.p + f.positivos });
  }
  const porEdad = edades.map((edad) => {
    const a = acumEdad.get(edad) ?? { n: 0, p: 0 };
    return { edad, n: conteo(a.n), positivo: proporcion(a.p, a.n) };
  });
  const porSexo = sexos.map((sexo) => {
    const a = acumSexo.get(sexo) ?? { n: 0, p: 0 };
    return { sexo, n: conteo(a.n), positivo: proporcion(a.p, a.n) };
  });
  const indiceInf = new Map(informantes.map((i) => [i.informante ?? "sin dato", i]));
  const porInformante = [...INFORMANTES, "sin dato"].map((informante) => {
    const i = indiceInf.get(informante) ?? { n: 0, positivos: 0 };
    return { informante, n: conteo(i.n), positivo: proporcion(i.positivos, i.n) };
  });
  const m = acumSexo.get("M");
  const f = acumSexo.get("F");
  const razonMF = m && f && m.p >= 5 && f.p >= 5 ? Math.round((m.p / f.p) * 100) / 100 : null;
  return { edades, sexos, edadPorSexo, porEdad, porSexo, porInformante, razonMF };
}
