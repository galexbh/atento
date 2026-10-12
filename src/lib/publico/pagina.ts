/**
 * Carga de datos para las páginas /datos y /datos/[anio] (servidor).
 */
import type { Publicacion } from "./datos";
import { type AnioPublicado, obtenerPublicacion } from "./publicar";
import { leerControles, type Modo } from "./vista";

type EnvPublico = Pick<Env, "DB" | "CACHE">;

export interface DatosInforme {
  p: Publicacion;
  anios: AnioPublicado[];
  modo: Modo;
  comparar: Publicacion | null;
  anioComparar: number | null;
  historico: Publicacion[];
}

/** null si el año no tiene publicación. */
export async function cargarInforme(
  env: EnvPublico,
  anio: number,
  anios: AnioPublicado[],
  params: URLSearchParams,
): Promise<DatosInforme | null> {
  const disponibles = anios.map((a) => a.anio);
  const p = await obtenerPublicacion(env, anio);
  if (!p) return null;
  const { modo, comparar: anioComparar } = leerControles(params, anio, disponibles);
  // Todas las publicaciones (pocas: una por año, cacheadas en KV) para la tabla por año.
  const historico = (
    await Promise.all(disponibles.map((a) => (a === anio ? p : obtenerPublicacion(env, a))))
  ).filter((x): x is Publicacion => x !== null);
  const comparar =
    modo === "comparar" && anioComparar !== null
      ? (historico.find((h) => h.anio === anioComparar) ?? null)
      : null;
  return {
    p,
    anios,
    modo: comparar ? modo : modo === "comparar" ? "pct" : modo,
    comparar,
    anioComparar,
    historico,
  };
}

/** Query string con solo los controles válidos (para redirigir de /datos?anio= a /datos/<anio>). */
export function consultaControles(params: URLSearchParams): string {
  const salida = new URLSearchParams();
  const modo = params.get("modo");
  if (modo === "pct" || modo === "n" || modo === "comparar") salida.set("modo", modo);
  const comparar = params.get("comparar");
  if (comparar && /^\d{4}$/.test(comparar)) salida.set("comparar", comparar);
  const q = salida.toString();
  return q ? `?${q}` : "";
}
