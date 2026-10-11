/**
 * Almacenamiento local del flujo público (todas las claves en localStorage).
 *
 * - `atento:consentimiento`: versión del consentimiento aceptada y casilla de investigación.
 * - `atento:datos`: departamento, municipio, edad, sexo e informante.
 * - `atento:progreso`: respuestas en curso, página actual y segundos acumulados.
 * - `atento:resultado`: solo puntajes/nivel (nunca los ítems) para la página de resultado.
 * - `atento:tema`: preferencia de modo claro/oscuro (ver tema.ts).
 *
 * Todas las lecturas toleran almacenamiento no disponible (modo privado, cuota) devolviendo null.
 */
import type { Escala, EscalaAlerta, Nivel } from "@/lib/puntuacion/tipos";

export const VERSION_CONSENTIMIENTO = "2026-10-11";

export const CLAVES = {
  consentimiento: "atento:consentimiento",
  datos: "atento:datos",
  progreso: "atento:progreso",
  resultado: "atento:resultado",
} as const;

export interface Consentimiento {
  version: string;
  investigacion: boolean;
  fecha: string;
}

export interface DatosNino {
  departamento: string;
  municipio: string;
  edadAnios: number;
  sexo: "F" | "M" | "X";
  informante: "madre" | "padre" | "cuidador" | "docente";
}

export interface Progreso {
  instrumentoId: string;
  respuestas: Record<string, number>;
  pagina: number;
  segundos: number;
  actualizado: string;
}

export interface ResultadoEscalaGuardada {
  escala: Escala;
  positivosCriterio: number;
  umbral: number;
  total: number;
  respondidos: number;
  puntaje: number;
  positivo: boolean;
}

export interface ResultadoGuardado {
  id: string;
  instrumentoId: string;
  versionInstrumento: string;
  nivel: Nivel;
  combinado: boolean;
  alertas: EscalaAlerta[];
  escalas: ResultadoEscalaGuardada[];
  itemsFaltantes: number;
  faltanSintomas: "ninguna" | "parcial" | "total";
  codigoVinculo: string;
  guardado: boolean;
  investigacion: boolean;
  fecha: string;
  edadAnios: number;
  informante: DatosNino["informante"];
  duracionSegundos: number;
}

function leer<T>(clave: string): T | null {
  try {
    const bruto = localStorage.getItem(clave);
    return bruto ? (JSON.parse(bruto) as T) : null;
  } catch {
    return null;
  }
}

function escribir(clave: string, valor: unknown): boolean {
  try {
    localStorage.setItem(clave, JSON.stringify(valor));
    return true;
  } catch {
    return false;
  }
}

function borrar(clave: string): void {
  try {
    localStorage.removeItem(clave);
  } catch {
    // nada
  }
}

export const almacen = {
  leerConsentimiento: () => leer<Consentimiento>(CLAVES.consentimiento),
  guardarConsentimiento: (c: Consentimiento) => escribir(CLAVES.consentimiento, c),
  leerDatos: () => leer<DatosNino>(CLAVES.datos),
  guardarDatos: (d: DatosNino) => escribir(CLAVES.datos, d),
  leerProgreso: () => leer<Progreso>(CLAVES.progreso),
  guardarProgreso: (p: Progreso) => escribir(CLAVES.progreso, p),
  borrarProgreso: () => borrar(CLAVES.progreso),
  leerResultado: () => leer<ResultadoGuardado>(CLAVES.resultado),
  guardarResultado: (r: ResultadoGuardado) => escribir(CLAVES.resultado, r),
  borrarTodo: () => {
    for (const clave of Object.values(CLAVES)) borrar(clave);
  },
};

/** Código de vínculo: 8 caracteres alfanuméricos aleatorios (sin relación con ningún dato). */
export function generarCodigoVinculo(): string {
  const alfabeto = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  let codigo = "";
  for (const b of bytes) codigo += alfabeto[b % alfabeto.length];
  return codigo;
}

/** Formato legible del código: XXXX-XXXX. */
export function formatearCodigo(codigo: string): string {
  return `${codigo.slice(0, 4)}-${codigo.slice(4)}`;
}
