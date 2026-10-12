/**
 * Almacenamiento local del flujo público (todas las claves en localStorage).
 *
 * - `atento:consentimiento`: versión del consentimiento aceptada y casilla de investigación.
 * - `atento:datos`: departamento, municipio, edad, sexo e informante.
 * - `atento:progreso`: respuestas en curso, página actual y segundos acumulados.
 * - `atento:resultado`: solo puntajes/nivel (nunca los ítems) para la página de resultado;
 *   caduca a los 30 días (se borra al leerlo).
 * - `atento:tema`: preferencia de modo claro/oscuro (ver tema.ts).
 *
 * Todas las lecturas toleran almacenamiento no disponible (modo privado, cuota) devolviendo null.
 */
import type { Escala, EscalaAlerta, Nivel } from "@/lib/puntuacion/tipos";

export const VERSION_CONSENTIMIENTO = "2026-10-11";

/** Días que se conserva `atento:resultado` en el dispositivo. */
export const DIAS_CADUCIDAD_RESULTADO = 30;
/** Mensaje al service worker para vaciar la cola de envíos pendientes (IndexedDB `atento-cola`). */
export const MENSAJE_SW_VACIAR_COLA = "atento:vaciar-cola";

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
  leerResultado: (ahora = Date.now()): ResultadoGuardado | null => {
    const r = leer<ResultadoGuardado>(CLAVES.resultado);
    if (!r) return null;
    const fecha = Date.parse(r.fecha);
    if (Number.isNaN(fecha) || ahora - fecha > DIAS_CADUCIDAD_RESULTADO * 86_400_000) {
      borrar(CLAVES.resultado);
      return null;
    }
    return r;
  },
  guardarResultado: (r: ResultadoGuardado) => escribir(CLAVES.resultado, r),
  borrarTodo: () => {
    for (const clave of Object.values(CLAVES)) borrar(clave);
  },
};

/**
 * "Borrar mis datos de este dispositivo": vacía localStorage (consentimiento, datos, progreso,
 * resultado) y pide al service worker que descarte la cola de envíos pendientes. No puede borrar
 * lo ya enviado al servidor (para eso está el código de vínculo).
 */
export async function borrarDatosDelDispositivo(): Promise<void> {
  almacen.borrarTodo();
  try {
    if ("serviceWorker" in navigator) {
      const registro = await navigator.serviceWorker.getRegistration();
      registro?.active?.postMessage(MENSAJE_SW_VACIAR_COLA);
    }
  } catch {
    // Sin service worker: no hay cola que vaciar.
  }
  try {
    indexedDB.deleteDatabase("atento-cola");
  } catch {
    // IndexedDB no disponible.
  }
}

/** Conecta un botón o enlace de "borrar mis datos" (atributo `data-borrar-datos`). */
export function iniciarBorrarDatos(raiz: ParentNode = document): void {
  for (const el of raiz.querySelectorAll<HTMLElement>("[data-borrar-datos]")) {
    el.addEventListener("click", async (ev) => {
      ev.preventDefault();
      const ok = window.confirm(
        "Se borrarán de este dispositivo el consentimiento, los datos del cuestionario, el progreso y el resultado. ¿Continuar?",
      );
      if (!ok) return;
      await borrarDatosDelDispositivo();
      window.location.href = "/?datos=borrados";
    });
  }
}

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
