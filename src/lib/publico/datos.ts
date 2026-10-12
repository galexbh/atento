/**
 * Publicación pública segura de los agregados (página /datos y /api/publico/*).
 *
 * Función pura: recibe conteos agrupados por (departamento, municipio, trimestre) de UN año y
 * devuelve lo que se puede publicar. Reglas (decididas; ver README "Regla de publicación"):
 *
 * 1. Granularidad pública = año calendario (sin mes, trimestre geográfico ni acumulado).
 * 2. Supresión primaria: celda con 0 < n < 5 -> `suprimido: true`, sin n ni porcentajes.
 * 3. Supresión complementaria: dentro de cada grupo con total publicado (municipios de un
 *    departamento; departamentos respecto del total nacional; trimestres respecto del total
 *    anual), si la suma de n de las celdas suprimidas es 1–4 se suprime además la celda visible
 *    con menor n, hasta que la suma suprimida sea >= 5 o no queden visibles. Así ninguna celda
 *    pequeña se reconstruye como "total − suma de visibles".
 *    Si un departamento queda suprimido (por cualquier motivo), se suprimen todos sus
 *    municipios: si no, su total se recuperaría sumándolos.
 *    Si el total nacional del año es < 5 no se publica nada (devuelve null).
 * 4. Serie temporal: solo nacional, por trimestre, con las mismas reglas.
 * 5. Porcentajes e IC95 de Wilson redondeados a 1 decimal.
 * 6. "% con indicadores" = inatención O hiperactividad positiva (igual que `pct_combinado`).
 *
 * Las celdas con n = 0 no se publican (no aparecen): "sin respuestas".
 */
import { intervaloWilson } from "../agregados/calcular";
import { obtenerDepartamento, obtenerMunicipio } from "../catalogo/geo";

export const UMBRAL_PUBLICO = 5;
export const VERSION_PRELIMINAR = "preliminar";
export const VERSION_CERRADA = "v1";
export const CODIGO_NACIONAL = "HN";

/** Conteos agrupados de `respuestas` (completado = 1 y consentimiento_investigacion = 1). */
export interface FilaConteo {
  departamento: string;
  municipio: string;
  /** 1–4 */
  trimestre: number;
  n: number;
  /** Con inatención o hiperactividad positiva. */
  n_pos: number;
  n_inat: number;
  n_hiper: number;
}

export interface Celda {
  /** null si está suprimido (nunca se publica un n < 5, ni siquiera el exacto). */
  n: number | null;
  suprimido: boolean;
  /** % con indicadores (inatención o hiperactividad), 1 decimal. */
  pctIndicadores: number | null;
  /** IC95 de Wilson de `pctIndicadores`, 1 decimal. */
  ic95: [number, number] | null;
  pctInatencion: number | null;
  pctHiperactividad: number | null;
}

export interface CeldaDepto extends Celda {
  codigo: string;
  nombre: string;
}

export interface CeldaMuni extends Celda {
  codigo: string;
  nombre: string;
  departamento: string;
}

export interface CeldaTrim extends Celda {
  /** "2026-Q1" */
  codigo: string;
  trimestre: number;
}

export interface ClaseEscala {
  /** Límite inferior incluido (null = sin límite). */
  desde: number | null;
  /** Límite superior excluido (null = sin límite). */
  hasta: number | null;
  etiqueta: string;
}

export interface Clases {
  pct: ClaseEscala[];
  n: ClaseEscala[];
  diferencia: ClaseEscala[];
}

export interface Publicacion {
  anio: number;
  preliminar: boolean;
  generadoEn: string;
  versionDataset: string;
  nacional: Celda;
  departamentos: CeldaDepto[];
  municipios: CeldaMuni[];
  serieTrimestral: CeldaTrim[];
  clases: Clases;
  /**
   * Solo en preliminares: último trimestre incluido ("2026-Q3"). El año en curso se publica con
   * corte al cierre del último trimestre completo y sin municipios, para que comparar dos
   * versiones sucesivas no aísle respuestas recientes en celdas pequeñas.
   */
  corte?: string | null;
}

export interface OpcionesPublicacion {
  preliminar: boolean;
  generadoEn: string;
  versionDataset: string;
}

/** Escalas fijas (iguales todos los años para poder comparar). */
export const CLASES: Clases = {
  pct: [
    { desde: null, hasta: 5, etiqueta: "< 5 %" },
    { desde: 5, hasta: 10, etiqueta: "5–10 %" },
    { desde: 10, hasta: 15, etiqueta: "10–15 %" },
    { desde: 15, hasta: 20, etiqueta: "15–20 %" },
    { desde: 20, hasta: null, etiqueta: "≥ 20 %" },
  ],
  n: [
    { desde: 5, hasta: 20, etiqueta: "5–19" },
    { desde: 20, hasta: 50, etiqueta: "20–49" },
    { desde: 50, hasta: 100, etiqueta: "50–99" },
    { desde: 100, hasta: null, etiqueta: "≥ 100" },
  ],
  diferencia: [
    { desde: null, hasta: -5, etiqueta: "≤ −5 pp" },
    { desde: -5, hasta: -1, etiqueta: "−5 a −1 pp" },
    { desde: -1, hasta: 1, etiqueta: "−1 a 1 pp" },
    { desde: 1, hasta: 5, etiqueta: "1 a 5 pp" },
    { desde: 5, hasta: null, etiqueta: "≥ 5 pp" },
  ],
};

/** Clase 1..5 de un % con indicadores (cortes fijos 5/10/15/20). */
export function clasePct(pct: number): number {
  if (pct < 5) return 1;
  if (pct < 10) return 2;
  if (pct < 15) return 3;
  if (pct < 20) return 4;
  return 5;
}

/** Clase 1..4 de un n publicado (>= 5): 5–19, 20–49, 50–99, >= 100. */
export function claseN(n: number): number {
  if (n < 20) return 1;
  if (n < 50) return 2;
  if (n < 100) return 3;
  return 4;
}

/** Clase 1..5 de una diferencia en puntos porcentuales (extremos inclusivos: ≤ −5 y ≥ 5). */
export function claseDiferencia(pp: number): number {
  if (pp <= -5) return 1;
  if (pp >= 5) return 5;
  if (pp < -1) return 2;
  if (pp > 1) return 4;
  return 3;
}

export function redondear1(x: number): number {
  return Math.round(x * 10) / 10;
}

interface Acumulado {
  n: number;
  pos: number;
  inat: number;
  hiper: number;
}

const vacio = (): Acumulado => ({ n: 0, pos: 0, inat: 0, hiper: 0 });

function sumarEn<K>(mapa: Map<K, Acumulado>, clave: K, f: FilaConteo) {
  let a = mapa.get(clave);
  if (!a) {
    a = vacio();
    mapa.set(clave, a);
  }
  a.n += f.n;
  a.pos += f.n_pos;
  a.inat += f.n_inat;
  a.hiper += f.n_hiper;
}

function celdaVisible(a: Acumulado): Celda {
  const [inf, sup] = intervaloWilson(a.pos, a.n);
  return {
    n: a.n,
    suprimido: false,
    pctIndicadores: redondear1((100 * a.pos) / a.n),
    ic95: [redondear1(inf * 100), redondear1(sup * 100)],
    pctInatencion: redondear1((100 * a.inat) / a.n),
    pctHiperactividad: redondear1((100 * a.hiper) / a.n),
  };
}

function celdaSuprimida(): Celda {
  return {
    n: null,
    suprimido: true,
    pctIndicadores: null,
    ic95: null,
    pctInatencion: null,
    pctHiperactividad: null,
  };
}

/**
 * Supresión primaria + complementaria dentro de un grupo cuyo total se publica (o se deduce).
 * `forzadas` son claves que deben suprimirse de antemano (p. ej. municipios de un departamento
 * suprimido). Devuelve el conjunto de claves suprimidas. Determinista: ante empate de n se
 * elige la clave menor.
 */
export function suprimirGrupo(
  celdas: ReadonlyMap<string, number>,
  forzadas: ReadonlySet<string> = new Set(),
): Set<string> {
  const suprimidas = new Set<string>();
  let suma = 0;
  for (const [clave, n] of celdas) {
    if (n <= 0) continue;
    if (n < UMBRAL_PUBLICO || forzadas.has(clave)) {
      suprimidas.add(clave);
      suma += n;
    }
  }
  while (suprimidas.size > 0 && suma < UMBRAL_PUBLICO) {
    let elegida: string | null = null;
    let menor = Number.POSITIVE_INFINITY;
    for (const [clave, n] of celdas) {
      if (n <= 0 || suprimidas.has(clave)) continue;
      if (n < menor || (n === menor && elegida !== null && clave < elegida)) {
        menor = n;
        elegida = clave;
      }
    }
    if (elegida === null) break;
    suprimidas.add(elegida);
    suma += menor;
  }
  return suprimidas;
}

function soloN(m: Map<string, Acumulado>): Map<string, number> {
  return new Map([...m].map(([k, a]) => [k, a.n]));
}

/**
 * Construye la publicación de un año. Devuelve null si el total nacional del año es < 5
 * (no se publica nada para ese año).
 */
export function construirPublicacion(
  filas: readonly FilaConteo[],
  anio: number,
  opciones: OpcionesPublicacion,
): Publicacion | null {
  const nacional = vacio();
  const deptos = new Map<string, Acumulado>();
  const munis = new Map<string, Acumulado>();
  const muniDepto = new Map<string, string>();
  const trims = new Map<string, Acumulado>();

  for (const f of filas) {
    if (!(f.n > 0)) continue;
    nacional.n += f.n;
    nacional.pos += f.n_pos;
    nacional.inat += f.n_inat;
    nacional.hiper += f.n_hiper;
    sumarEn(deptos, f.departamento, f);
    sumarEn(munis, f.municipio, f);
    muniDepto.set(f.municipio, f.departamento);
    if (f.trimestre >= 1 && f.trimestre <= 4) sumarEn(trims, `${anio}-Q${f.trimestre}`, f);
  }

  if (nacional.n < UMBRAL_PUBLICO) return null;

  // Departamentos respecto del total nacional.
  const deptosSuprimidos = suprimirGrupo(soloN(deptos));

  // Municipios dentro de cada departamento.
  const munisPorDepto = new Map<string, Map<string, number>>();
  for (const [codigo, a] of munis) {
    const d = muniDepto.get(codigo) as string;
    let grupo = munisPorDepto.get(d);
    if (!grupo) {
      grupo = new Map();
      munisPorDepto.set(d, grupo);
    }
    grupo.set(codigo, a.n);
  }
  const munisSuprimidos = new Set<string>();
  for (const [d, grupo] of munisPorDepto) {
    const forzadas = deptosSuprimidos.has(d) ? new Set(grupo.keys()) : new Set<string>();
    for (const c of suprimirGrupo(grupo, forzadas)) munisSuprimidos.add(c);
  }

  // Trimestres respecto del total anual.
  const trimsSuprimidos = suprimirGrupo(soloN(trims));

  const ordenar = <T>(m: Map<string, T>) => [...m].sort(([a], [b]) => a.localeCompare(b));

  const departamentos: CeldaDepto[] = ordenar(deptos).map(([codigo, a]) => ({
    codigo,
    nombre: obtenerDepartamento(codigo)?.nombre ?? codigo,
    ...(deptosSuprimidos.has(codigo) ? celdaSuprimida() : celdaVisible(a)),
  }));

  const municipios: CeldaMuni[] = ordenar(munis).map(([codigo, a]) => ({
    codigo,
    nombre: obtenerMunicipio(codigo)?.nombre ?? codigo,
    departamento: muniDepto.get(codigo) as string,
    ...(munisSuprimidos.has(codigo) ? celdaSuprimida() : celdaVisible(a)),
  }));

  const serieTrimestral: CeldaTrim[] = ordenar(trims).map(([codigo, a]) => ({
    codigo,
    trimestre: Number(codigo.slice(-1)),
    ...(trimsSuprimidos.has(codigo) ? celdaSuprimida() : celdaVisible(a)),
  }));

  return {
    anio,
    preliminar: opciones.preliminar,
    generadoEn: opciones.generadoEn,
    versionDataset: opciones.versionDataset,
    nacional: celdaVisible(nacional),
    departamentos,
    municipios,
    serieTrimestral,
    clases: CLASES,
  };
}

// ---------------------------------------------------------------------------------------------
// CSV

export const COLUMNAS_CSV = [
  "nivel",
  "codigo",
  "nombre",
  "anio",
  "n",
  "pct_indicadores",
  "ic95_inf",
  "ic95_sup",
  "pct_inatencion",
  "pct_hiperactividad",
  "suprimido",
  "version_dataset",
  "preliminar",
] as const;

export const LICENCIA_URL = "https://creativecommons.org/licenses/by/4.0/";

function campoCsv(v: string | number | null): string {
  if (v === null) return "";
  if (typeof v === "number") return String(v);
  // Neutraliza fórmulas (los nombres vienen del catálogo, pero se protege igual).
  const seguro = /^[=+\-@\t\r]/.test(v) ? `'${v}` : v;
  return /[",\n\r]/.test(seguro) ? `"${seguro.replace(/"/g, '""')}"` : seguro;
}

/** CSV UTF-8 con BOM: una fila por celda (nacional, departamentos, municipios, trimestres). */
export function publicacionACsv(p: Publicacion): string {
  const filas: (string | number | null)[][] = [];
  const agregar = (nivel: string, codigo: string, nombre: string, c: Celda) => {
    filas.push([
      nivel,
      codigo,
      nombre,
      p.anio,
      c.suprimido ? null : c.n,
      c.pctIndicadores,
      c.ic95?.[0] ?? null,
      c.ic95?.[1] ?? null,
      c.pctInatencion,
      c.pctHiperactividad,
      c.suprimido ? 1 : 0,
      p.versionDataset,
      p.preliminar ? 1 : 0,
    ]);
  };
  agregar("nacional", CODIGO_NACIONAL, "Honduras", p.nacional);
  for (const d of p.departamentos) agregar("departamento", d.codigo, d.nombre, d);
  for (const m of p.municipios) agregar("municipio", m.codigo, m.nombre, m);
  for (const t of p.serieTrimestral) agregar("trimestre", t.codigo, `Trimestre ${t.trimestre}`, t);
  const lineas = [COLUMNAS_CSV.join(","), ...filas.map((f) => f.map(campoCsv).join(","))];
  return `﻿${lineas.join("\r\n")}\r\n`;
}

export function nombreArchivo(
  p: Pick<Publicacion, "anio" | "versionDataset">,
  ext: "csv" | "json",
) {
  return `atento-datos-${p.anio}-${p.versionDataset}.${ext}`;
}
