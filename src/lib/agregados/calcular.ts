/**
 * Cálculo puro de agregados (sin D1 ni KV): se usa en el cron, en el panel admin y en
 * `scripts/agregar-local.ts`.
 *
 * Definiciones (ver migrations/0002):
 * - `pct_inatencion`, `pct_hiperactividad`: % de cribados con esa escala positiva.
 * - `pct_combinado`: % con inatención O hiperactividad positiva (cualquiera de las dos).
 *   Es la cifra "con indicadores" del mapa y la que lleva el intervalo de Wilson.
 * - `pct_ambas`: % con las dos escalas positivas a la vez.
 * - Porcentajes en escala 0–100 con dos decimales; intervalo de Wilson al 95 % también en 0–100.
 * - Supresión: n < UMBRAL_SUPRESION -> `suprimido = 1` y todos los porcentajes en NULL (se
 *   conserva n para que el mapa pueda mostrar "datos insuficientes").
 *
 * Claves:
 * - Periodos: "acumulado", año "2026", trimestre "2026-Q4" y mes "2026-10".
 * - Filas por municipio (código INE de 4 dígitos) y, además, una fila por departamento con
 *   `municipio = departamento + "00"` (p. ej. "0800" = Francisco Morazán), código que ningún
 *   municipio real usa (los municipios van de 01 en adelante).
 * - `version_instrumento`: cada versión real y, además, "todas". Las respuestas de instrumentos
 *   que no cuentan en el mapa (versión docente, ver `INSTRUMENTOS_FUERA_DEL_MAPA`) solo se agregan
 *   en su propia versión, nunca en "todas", para no contar dos veces al mismo niño (familia y
 *   docente). El panel las ve filtrando por su versión.
 */
import { cuentaEnMapa } from "../puntuacion/instrumentos";

export const UMBRAL_SUPRESION = 5;
export const VERSION_TODAS = "todas";
export const PERIODO_ACUMULADO = "acumulado";
const Z_95 = 1.959964;

/** Fila mínima de `respuestas` necesaria para agregar. */
export interface FilaRespuesta {
  /** YYYY-MM-DD */
  creado_en: string;
  departamento: string;
  municipio: string;
  pos_inatencion: number | null;
  pos_hiperactividad: number | null;
  version_instrumento: string;
}

/** Fila de `agregados_municipio` (sin `calculado_en`, que pone quien escribe). */
export interface FilaAgregado {
  periodo: string;
  departamento: string;
  municipio: string;
  n: number;
  pct_inatencion: number | null;
  pct_hiperactividad: number | null;
  pct_combinado: number | null;
  pct_ambas: number | null;
  ic95_inf: number | null;
  ic95_sup: number | null;
  suprimido: 0 | 1;
  version_instrumento: string;
}

/** Intervalo de Wilson al 95 % para una proporción, en [0, 1]. */
export function intervaloWilson(exitos: number, n: number, z = Z_95): [number, number] {
  if (n <= 0) return [0, 0];
  const p = exitos / n;
  const z2 = z * z;
  const denominador = 1 + z2 / n;
  const centro = (p + z2 / (2 * n)) / denominador;
  const margen = (z * Math.sqrt((p * (1 - p)) / n + z2 / (4 * n * n))) / denominador;
  return [Math.max(0, centro - margen), Math.min(1, centro + margen)];
}

/** Periodos a los que pertenece una fecha YYYY-MM-DD: acumulado, año, trimestre y mes. */
export function periodosDeFecha(fecha: string): string[] {
  const anio = fecha.slice(0, 4);
  const mes = Number.parseInt(fecha.slice(5, 7), 10);
  if (!/^\d{4}$/.test(anio) || !(mes >= 1 && mes <= 12)) {
    throw new Error(`Fecha inválida para agregar: "${fecha}"`);
  }
  const trimestre = Math.floor((mes - 1) / 3) + 1;
  const mes2 = String(mes).padStart(2, "0");
  return [PERIODO_ACUMULADO, anio, `${anio}-Q${trimestre}`, `${anio}-${mes2}`];
}

/** Código de la fila "departamento" dentro de agregados_municipio. */
export function codigoDepartamentoAgregado(departamento: string): string {
  return `${departamento}00`;
}

/** Verdadero si el código de municipio de un agregado representa a todo el departamento. */
export function esCodigoDepartamento(municipio: string): boolean {
  return municipio.length === 4 && municipio.endsWith("00");
}

interface Acumulador {
  periodo: string;
  departamento: string;
  municipio: string;
  version_instrumento: string;
  n: number;
  inatencion: number;
  hiperactividad: number;
  cualquiera: number;
  ambas: number;
}

function redondear2(x: number): number {
  return Math.round(x * 100) / 100;
}

function pct(k: number, n: number): number {
  return redondear2((100 * k) / n);
}

function cerrar(a: Acumulador): FilaAgregado {
  const base = {
    periodo: a.periodo,
    departamento: a.departamento,
    municipio: a.municipio,
    n: a.n,
    version_instrumento: a.version_instrumento,
  };
  if (a.n < UMBRAL_SUPRESION) {
    return {
      ...base,
      pct_inatencion: null,
      pct_hiperactividad: null,
      pct_combinado: null,
      pct_ambas: null,
      ic95_inf: null,
      ic95_sup: null,
      suprimido: 1,
    };
  }
  const [inf, sup] = intervaloWilson(a.cualquiera, a.n);
  return {
    ...base,
    pct_inatencion: pct(a.inatencion, a.n),
    pct_hiperactividad: pct(a.hiperactividad, a.n),
    pct_combinado: pct(a.cualquiera, a.n),
    pct_ambas: pct(a.ambas, a.n),
    ic95_inf: redondear2(inf * 100),
    ic95_sup: redondear2(sup * 100),
    suprimido: 0,
  };
}

/**
 * Agrega filas de `respuestas` en filas de `agregados_municipio`.
 * Solo produce filas para combinaciones con al menos una respuesta.
 * El orden de salida es determinista (periodo, versión, municipio).
 */
export function agregar(filas: Iterable<FilaRespuesta>): FilaAgregado[] {
  const acumuladores = new Map<string, Acumulador>();

  const sumar = (periodo: string, municipio: string, version: string, fila: FilaRespuesta) => {
    const clave = `${periodo}|${municipio}|${version}`;
    let a = acumuladores.get(clave);
    if (!a) {
      a = {
        periodo,
        departamento: fila.departamento,
        municipio,
        version_instrumento: version,
        n: 0,
        inatencion: 0,
        hiperactividad: 0,
        cualquiera: 0,
        ambas: 0,
      };
      acumuladores.set(clave, a);
    }
    const ina = fila.pos_inatencion === 1;
    const hip = fila.pos_hiperactividad === 1;
    a.n += 1;
    if (ina) a.inatencion += 1;
    if (hip) a.hiperactividad += 1;
    if (ina || hip) a.cualquiera += 1;
    if (ina && hip) a.ambas += 1;
  };

  for (const fila of filas) {
    const versiones =
      fila.version_instrumento === VERSION_TODAS
        ? [VERSION_TODAS]
        : cuentaEnMapa(fila.version_instrumento)
          ? [fila.version_instrumento, VERSION_TODAS]
          : [fila.version_instrumento];
    const codigos = [fila.municipio, codigoDepartamentoAgregado(fila.departamento)];
    for (const periodo of periodosDeFecha(fila.creado_en)) {
      for (const version of versiones) {
        for (const municipio of codigos) sumar(periodo, municipio, version, fila);
      }
    }
  }

  return [...acumuladores.values()]
    .sort(
      (x, y) =>
        x.periodo.localeCompare(y.periodo) ||
        x.version_instrumento.localeCompare(y.version_instrumento) ||
        x.municipio.localeCompare(y.municipio),
    )
    .map(cerrar);
}
