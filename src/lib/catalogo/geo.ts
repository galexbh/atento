/**
 * Catálogo geográfico de Honduras: 18 departamentos y 298 municipios con
 * códigos oficiales INE (departamento 2 dígitos, municipio 4 dígitos).
 * Datos en `src/data/geo/honduras.json`.
 */
import datos from "../../data/geo/honduras.json";

export interface Departamento {
  /** Código INE de 2 dígitos, "01"–"18". */
  codigo: string;
  nombre: string;
}

export interface Municipio {
  /** Código INE de 4 dígitos: departamento + 2 dígitos. */
  codigo: string;
  nombre: string;
  /** Código del departamento (2 dígitos). */
  departamento: string;
}

const DEPARTAMENTOS: readonly Departamento[] = datos.departamentos;
const MUNICIPIOS: readonly Municipio[] = datos.municipios;

const MUNICIPIO_POR_CODIGO: ReadonlyMap<string, Municipio> = new Map(
  MUNICIPIOS.map((m) => [m.codigo, m]),
);
const DEPARTAMENTO_POR_CODIGO: ReadonlyMap<string, Departamento> = new Map(
  DEPARTAMENTOS.map((d) => [d.codigo, d]),
);

/** Departamentos ordenados por código INE. */
export function listarDepartamentos(): Departamento[] {
  return [...DEPARTAMENTOS];
}

export function obtenerDepartamento(codigo: string): Departamento | undefined {
  return DEPARTAMENTO_POR_CODIGO.get(codigo);
}

/** Municipios de un departamento, ordenados por código INE (cabecera primero). */
export function listarMunicipios(codDepto: string): Municipio[] {
  return MUNICIPIOS.filter((m) => m.departamento === codDepto);
}

export function obtenerMunicipio(codigo: string): Municipio | undefined {
  return MUNICIPIO_POR_CODIGO.get(codigo);
}

/** Verdadero si el municipio existe y pertenece al departamento indicado. */
export function esMunicipioValido(codigo: string, codDepto: string): boolean {
  const m = MUNICIPIO_POR_CODIGO.get(codigo);
  return m !== undefined && m.departamento === codDepto;
}

/** Todos los municipios (copia), útil para pruebas y exportaciones. */
export function listarTodosLosMunicipios(): Municipio[] {
  return [...MUNICIPIOS];
}
