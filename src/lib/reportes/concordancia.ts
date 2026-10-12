/**
 * Reporte 11: concordancia padre–docente.
 *
 * Empareja respuestas de la familia y del docente que comparten `codigo_vinculo` (el código que
 * genera la familia y comparte con el docente en `/docente?codigo=`).
 *
 * Reglas (documentadas también en docs/02-instrumento/version-docente.md):
 * - Familia = cualquier instrumento que no sea el docente y con informante distinto de "docente"
 *   (las filas antiguas en las que una familia marcó "docente" con el instrumento de padres no
 *   cuentan como ninguno de los dos lados). Docente = instrumento `vanderbilt-docente-es-1.0`.
 * - Si un código tiene varias filas de un mismo informante se usa la MÁS RECIENTE de cada lado
 *   (mayor `creado_en`; empate: mayor `id`, determinista). Se informa cuántos códigos tenían
 *   filas repetidas.
 * - Los filtros del panel (departamento, municipio, edad, sexo) se aplican a la fila de la
 *   familia (residencia y datos del niño); el periodo y "solo con consentimiento" a las dos.
 *   Los filtros de informante e instrumento no aplican (el reporte usa ambos por definición).
 * - Solo cribados completados. El código se compara en mayúsculas.
 *
 * Medidas, por escala:
 * - Acuerdo en positividad: tabla 2×2, % de acuerdo (IC de Wilson) y kappa de Cohen (IC 95 %).
 *   Escalas: inatención, hiperactividad, "con indicadores" (inatención o hiperactividad),
 *   oposición/conducta (familia: oposición O conducta; docente: escala combinada 19–28, guardada
 *   en `conducta`; no son equivalentes ítem a ítem), ansiedad/depresión y desempeño.
 * - Correlación de Pearson de puntajes en los 18 síntomas comparables (ítems 1–18, equivalentes
 *   en ambos formularios): inatención (1–9), hiperactividad (10–18) y total 1–18.
 * - "Positivo en ambos entornos": % de pares con inatención o hiperactividad positiva según la
 *   familia Y según el docente (criterio de dos entornos del DSM-5; aquí solo orientativo).
 *
 * Supresión: con menos de 5 pares no se publica ninguna medida; cada celda de las tablas 2×2
 * con n < 5 se suprime como el resto del panel.
 */
import { INSTRUMENTO_DOCENTE } from "../puntuacion/instrumentos";
import { consultar, type Db, where } from "./comun";
import { intervaloPearson, kappaCohen, media, pearson, redondear } from "./estadistica";
import type { Filtros } from "./filtros";
import { type Celda, conteo, estaSuprimido, type Proporcion, proporcion } from "./supresion";

export interface FilaConcordancia {
  codigo: string;
  id: string;
  creado_en: string;
  pos_inatencion: number | null;
  pos_hiperactividad: number | null;
  pos_oposicion: number | null;
  pos_conducta: number | null;
  pos_ansiedad_depresion: number | null;
  pos_desempeno: number | null;
  punt_inatencion: number | null;
  punt_hiperactividad: number | null;
}

export type EscalaConcordancia =
  | "inatencion"
  | "hiperactividad"
  | "sintomas"
  | "oposicion_conducta"
  | "ansiedad_depresion"
  | "desempeno";

export interface AcuerdoEscala {
  escala: EscalaConcordancia;
  etiqueta: string;
  /** Pares con dato en ambos lados. */
  n: Celda;
  tabla: { ambos: Celda; soloFamilia: Celda; soloDocente: Celda; ninguno: Celda };
  acuerdo: Proporcion;
  kappa: { valor: number; ic95: { inferior: number; superior: number } } | null;
}

export interface CorrelacionEscala {
  escala: "inatencion" | "hiperactividad" | "total_1_18";
  etiqueta: string;
  n: Celda;
  r: number | null;
  ic95: { inferior: number; superior: number } | null;
  mediaFamilia: number | null;
  mediaDocente: number | null;
}

export interface ReporteConcordancia {
  pares: Celda;
  familiasConCodigo: Celda;
  docentesConCodigo: Celda;
  docentesSinCodigo: Celda;
  /** Códigos con más de una fila de familia o de docente (se usó la más reciente). */
  codigosRepetidos: Celda;
  acuerdo: AcuerdoEscala[];
  correlacion: CorrelacionEscala[];
  /** % de pares con indicadores (inatención o hiperactividad) en los dos entornos. */
  dosEntornos: Proporcion;
  regla: string;
}

export const REGLA_EMPAREJAMIENTO =
  "Un par = una respuesta de familia y una de docente con el mismo código de vínculo. Si hay varias del mismo informante, se usa la más reciente (empate: id mayor). Filtros geográficos y demográficos sobre la fila de la familia; periodo y consentimiento sobre ambas.";

const ETIQUETAS: Record<EscalaConcordancia, string> = {
  inatencion: "Inatención",
  hiperactividad: "Hiperactividad/impulsividad",
  sintomas: "Con indicadores (inatención o hiperactividad)",
  oposicion_conducta: "Oposición/conducta (familia: oposición o conducta)",
  ansiedad_depresion: "Ansiedad/depresión",
  desempeno: "Desempeño",
};

type Lado = "familia" | "docente";

function positivo(f: FilaConcordancia, escala: EscalaConcordancia, lado: Lado): boolean | null {
  const uno = (v: number | null) => (v === null ? null : v === 1);
  switch (escala) {
    case "inatencion":
      return uno(f.pos_inatencion);
    case "hiperactividad":
      return uno(f.pos_hiperactividad);
    case "sintomas": {
      const a = uno(f.pos_inatencion);
      const b = uno(f.pos_hiperactividad);
      if (a === null && b === null) return null;
      return a === true || b === true;
    }
    case "oposicion_conducta": {
      if (lado === "docente") return uno(f.pos_conducta);
      const a = uno(f.pos_oposicion);
      const b = uno(f.pos_conducta);
      if (a === null && b === null) return null;
      return a === true || b === true;
    }
    case "ansiedad_depresion":
      return uno(f.pos_ansiedad_depresion);
    case "desempeno":
      return uno(f.pos_desempeno);
  }
}

/** La fila más reciente por código (mayor creado_en; empate: mayor id). */
export function masRecientePorCodigo(filas: readonly FilaConcordancia[]): {
  porCodigo: Map<string, FilaConcordancia>;
  repetidos: Set<string>;
} {
  const porCodigo = new Map<string, FilaConcordancia>();
  const repetidos = new Set<string>();
  for (const f of filas) {
    const previa = porCodigo.get(f.codigo);
    if (!previa) {
      porCodigo.set(f.codigo, f);
      continue;
    }
    repetidos.add(f.codigo);
    const masNueva =
      f.creado_en > previa.creado_en || (f.creado_en === previa.creado_en && f.id > previa.id);
    if (masNueva) porCodigo.set(f.codigo, f);
  }
  return { porCodigo, repetidos };
}

export interface EntradaConcordancia {
  familias: readonly FilaConcordancia[];
  /** Filas docentes CON código. */
  docentes: readonly FilaConcordancia[];
  /** Respuestas docentes sin código en el periodo (solo para contarlas). */
  docentesSinCodigo: number;
}

/** Cálculo puro del reporte (se prueba sin D1). */
export function calcularConcordancia(entrada: EntradaConcordancia): ReporteConcordancia {
  const fam = masRecientePorCodigo(entrada.familias);
  const doc = masRecientePorCodigo(entrada.docentes);
  const pares: Array<{ familia: FilaConcordancia; docente: FilaConcordancia }> = [];
  for (const [codigo, familia] of fam.porCodigo) {
    const docente = doc.porCodigo.get(codigo);
    if (docente) pares.push({ familia, docente });
  }
  const repetidos = new Set(
    [...fam.repetidos, ...doc.repetidos].filter(
      (c) => fam.porCodigo.has(c) && doc.porCodigo.has(c),
    ),
  );
  const n = pares.length;
  const suprimirTodo = estaSuprimido(n);

  const acuerdo: AcuerdoEscala[] = (Object.keys(ETIQUETAS) as EscalaConcordancia[]).map(
    (escala) => {
      let a = 0;
      let b = 0;
      let c = 0;
      let d = 0;
      for (const p of pares) {
        const pf = positivo(p.familia, escala, "familia");
        const pd = positivo(p.docente, escala, "docente");
        if (pf === null || pd === null) continue;
        if (pf && pd) a++;
        else if (pf) b++;
        else if (pd) c++;
        else d++;
      }
      const total = a + b + c + d;
      const sup = suprimirTodo || estaSuprimido(total);
      const k = sup ? null : kappaCohen(a, b, c, d);
      return {
        escala,
        etiqueta: ETIQUETAS[escala],
        n: sup ? { n: 0, suprimido: true } : conteo(total),
        tabla: {
          ambos: sup ? { n: 0, suprimido: true } : conteo(a),
          soloFamilia: sup ? { n: 0, suprimido: true } : conteo(b),
          soloDocente: sup ? { n: 0, suprimido: true } : conteo(c),
          ninguno: sup ? { n: 0, suprimido: true } : conteo(d),
        },
        acuerdo: sup ? proporcion(0, 0) : proporcion(a + d, total),
        kappa: k
          ? {
              valor: redondear(k.kappa, 3) as number,
              ic95: {
                inferior: redondear(k.ic95.inferior, 3) as number,
                superior: redondear(k.ic95.superior, 3) as number,
              },
            }
          : null,
      };
    },
  );

  const series: Array<{
    escala: CorrelacionEscala["escala"];
    etiqueta: string;
    valor: (f: FilaConcordancia) => number | null;
  }> = [
    { escala: "inatencion", etiqueta: "Inatención (ítems 1–9)", valor: (f) => f.punt_inatencion },
    {
      escala: "hiperactividad",
      etiqueta: "Hiperactividad/impulsividad (ítems 10–18)",
      valor: (f) => f.punt_hiperactividad,
    },
    {
      escala: "total_1_18",
      etiqueta: "Total de síntomas (ítems 1–18)",
      valor: (f) =>
        f.punt_inatencion === null || f.punt_hiperactividad === null
          ? null
          : f.punt_inatencion + f.punt_hiperactividad,
    },
  ];
  const correlacion: CorrelacionEscala[] = series.map((s) => {
    const x: number[] = [];
    const y: number[] = [];
    for (const p of pares) {
      const vf = s.valor(p.familia);
      const vd = s.valor(p.docente);
      if (vf === null || vd === null) continue;
      x.push(vf);
      y.push(vd);
    }
    const sup = suprimirTodo || estaSuprimido(x.length);
    const r = sup ? null : pearson(x, y);
    const ic = r === null ? null : intervaloPearson(r, x.length);
    return {
      escala: s.escala,
      etiqueta: s.etiqueta,
      n: sup ? { n: 0, suprimido: true } : conteo(x.length),
      r: redondear(r, 3),
      ic95: ic
        ? {
            inferior: redondear(ic.inferior, 3) as number,
            superior: redondear(ic.superior, 3) as number,
          }
        : null,
      mediaFamilia: sup ? null : redondear(media(x), 2),
      mediaDocente: sup ? null : redondear(media(y), 2),
    };
  });

  const ambos = pares.filter(
    (p) =>
      positivo(p.familia, "sintomas", "familia") === true &&
      positivo(p.docente, "sintomas", "docente") === true,
  ).length;

  return {
    pares: conteo(n),
    familiasConCodigo: conteo(fam.porCodigo.size),
    docentesConCodigo: conteo(doc.porCodigo.size),
    docentesSinCodigo: conteo(entrada.docentesSinCodigo),
    codigosRepetidos: conteo(repetidos.size),
    acuerdo,
    correlacion,
    dosEntornos: suprimirTodo ? proporcion(0, 0) : proporcion(ambos, n),
    regla: REGLA_EMPAREJAMIENTO,
  };
}

const COLUMNAS = `UPPER(codigo_vinculo) AS codigo, id, creado_en, pos_inatencion, pos_hiperactividad,
  pos_oposicion, pos_conducta, pos_ansiedad_depresion, pos_desempeno, punt_inatencion,
  punt_hiperactividad`;

export async function reporteConcordancia(db: Db, filtros: Filtros): Promise<ReporteConcordancia> {
  const wFamilia = where({ ...filtros, informante: undefined, versionInstrumento: undefined });
  const wDocente = where({
    periodo: filtros.periodo,
    soloConsentimiento: filtros.soloConsentimiento,
  });
  const [familias, docentes, sinCodigo] = await Promise.all([
    consultar<FilaConcordancia>(
      db,
      `SELECT ${COLUMNAS} FROM respuestas ${wFamilia.sql}
       AND codigo_vinculo IS NOT NULL AND version_instrumento <> ?
       AND COALESCE(informante, '') <> 'docente'`,
      [...wFamilia.params, INSTRUMENTO_DOCENTE],
    ),
    consultar<FilaConcordancia>(
      db,
      `SELECT ${COLUMNAS} FROM respuestas ${wDocente.sql}
       AND codigo_vinculo IS NOT NULL AND version_instrumento = ?`,
      [...wDocente.params, INSTRUMENTO_DOCENTE],
    ),
    consultar<{ n: number }>(
      db,
      `SELECT COUNT(*) AS n FROM respuestas ${wDocente.sql}
       AND codigo_vinculo IS NULL AND version_instrumento = ?`,
      [...wDocente.params, INSTRUMENTO_DOCENTE],
    ),
  ]);
  return calcularConcordancia({
    familias,
    docentes,
    docentesSinCodigo: sinCodigo[0]?.n ?? 0,
  });
}
