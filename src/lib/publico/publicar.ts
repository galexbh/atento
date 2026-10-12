/**
 * Persistencia y versionado de las publicaciones públicas (tabla `publicaciones`, migración 0004).
 *
 * - Año en curso: `version = 'preliminar'`, se recalcula en cada recálculo pero solo incluye
 *   trimestres cerrados y solo departamentos, así que cambia una vez por trimestre.
 * - Años cerrados: si no existe `version = 'v1'`, se crea (inmutable desde entonces) y se borra la
 *   preliminar de ese año.
 * - Lectura: v1 (o la versión cerrada más alta) si existe; si no, la preliminar; si no hay
 *   ninguna (antes del primer cron), se calcula al vuelo y se guarda como preliminar.
 * - Caché KV bajo `agregado:publico:*` (lo invalida `invalidarCacheAgregados`), TTL 1 h.
 */
import { claveCacheAgregado, TTL_CACHE_AGREGADOS_S } from "../api/cache";
import { consultarAniosConDatos, consultarConteosAnio } from "./consultar";
import {
  construirPublicacion,
  type Publicacion,
  VERSION_CERRADA,
  VERSION_PRELIMINAR,
} from "./datos";

type EnvPublico = Pick<Env, "DB" | "CACHE">;

export const ANIO_MINIMO = 2020;
export const ANIO_MAXIMO = 2100;

export function claveCachePublicacion(anio: number): string {
  return claveCacheAgregado(["publico", String(anio)]);
}
export const CLAVE_CACHE_ANIOS = claveCacheAgregado(["publico", "anios"]);

/** Marcador en KV de "año sin datos publicables" (evita recalcular en cada visita). */
const SIN_DATOS = "null";

export interface ResultadoPublicar {
  preliminares: number[];
  cerrados: number[];
}

const SQL_GUARDAR_PRELIMINAR = `INSERT INTO publicaciones (anio, version, preliminar, datos, generado_en)
VALUES (?, 'preliminar', 1, ?, ?)
ON CONFLICT (anio, version) DO UPDATE SET datos = excluded.datos, generado_en = excluded.generado_en`;

const SQL_CREAR_CERRADA = `INSERT OR IGNORE INTO publicaciones (anio, version, preliminar, datos, generado_en)
VALUES (?, ?, 0, ?, ?)`;

const SQL_BORRAR_PRELIMINAR = "DELETE FROM publicaciones WHERE anio = ? AND version = 'preliminar'";

/**
 * Último trimestre completamente cerrado de `anio` en la fecha `ahora` (0 si ninguno; 4 si el
 * año ya terminó).
 */
export function ultimoTrimestreCerrado(anio: number, ahora: Date): number {
  const anioActual = ahora.getUTCFullYear();
  if (anio < anioActual) return 4;
  if (anio > anioActual) return 0;
  return Math.floor(ahora.getUTCMonth() / 3);
}

async function calcular(
  db: D1Database,
  anio: number,
  preliminar: boolean,
  generadoEn: string,
  ahora: Date,
): Promise<Publicacion | null> {
  const todas = await consultarConteosAnio(db, anio);
  if (!preliminar) {
    return construirPublicacion(todas, anio, {
      preliminar,
      generadoEn,
      versionDataset: VERSION_CERRADA,
    });
  }
  // Preliminar: solo trimestres cerrados y solo departamentos (ver `Publicacion.corte`).
  const corte = ultimoTrimestreCerrado(anio, ahora);
  if (corte === 0) return null;
  const filas = todas.filter((f) => f.trimestre <= corte);
  const p = construirPublicacion(filas, anio, {
    preliminar,
    generadoEn,
    versionDataset: VERSION_PRELIMINAR,
  });
  if (!p) return null;
  return {
    ...p,
    municipios: [],
    serieTrimestral: p.serieTrimestral.filter((t) => t.trimestre <= corte),
    corte: `${anio}-Q${corte}`,
  };
}

/**
 * Recalcula las publicaciones. La llaman `recalcularAgregados` (y por tanto el cron diario
 * `ejecutarCronDiario` y la acción del panel). No invalida la caché: lo hace quien la llama.
 */
export async function publicarAnios(
  env: EnvPublico,
  ahora: Date = new Date(),
): Promise<ResultadoPublicar> {
  const generadoEn = ahora.toISOString();
  const anioActual = ahora.getUTCFullYear();
  const anios = await consultarAniosConDatos(env.DB);
  const resultado: ResultadoPublicar = { preliminares: [], cerrados: [] };

  const cerradas = await env.DB.prepare("SELECT anio FROM publicaciones WHERE version = ?")
    .bind(VERSION_CERRADA)
    .all<{ anio: number }>();
  const conV1 = new Set(cerradas.results.map((r) => Number(r.anio)));

  for (const anio of anios) {
    if (anio >= anioActual) {
      const p = await calcular(env.DB, anio, true, generadoEn, ahora);
      if (p) {
        await env.DB.prepare(SQL_GUARDAR_PRELIMINAR)
          .bind(anio, JSON.stringify(p), generadoEn)
          .run();
        resultado.preliminares.push(anio);
      } else {
        await env.DB.prepare(SQL_BORRAR_PRELIMINAR).bind(anio).run();
      }
      continue;
    }
    if (conV1.has(anio)) continue;
    const p = await calcular(env.DB, anio, false, generadoEn, ahora);
    const sentencias: D1PreparedStatement[] = [];
    if (p) {
      sentencias.push(
        env.DB.prepare(SQL_CREAR_CERRADA).bind(
          anio,
          VERSION_CERRADA,
          JSON.stringify(p),
          generadoEn,
        ),
      );
      resultado.cerrados.push(anio);
    }
    sentencias.push(env.DB.prepare(SQL_BORRAR_PRELIMINAR).bind(anio));
    await env.DB.batch(sentencias);
  }
  return resultado;
}

/** Lee de D1 la mejor versión guardada de un año (cerrada más alta; si no, preliminar). */
async function leerGuardada(db: D1Database, anio: number): Promise<string | null> {
  const fila = await db
    .prepare(
      `SELECT datos FROM publicaciones WHERE anio = ?
       ORDER BY (version = 'preliminar'), length(version) DESC, version DESC LIMIT 1`,
    )
    .bind(anio)
    .first<{ datos: string }>();
  return fila?.datos ?? null;
}

/**
 * Publicación de un año (JSON serializado) o null si el año no tiene datos publicables.
 * Pasa por KV (TTL 1 h).
 */
export async function obtenerPublicacionJson(
  env: EnvPublico,
  anio: number,
  ahora: Date = new Date(),
): Promise<{ cuerpo: string | null; desdeCache: boolean }> {
  if (!Number.isInteger(anio) || anio < ANIO_MINIMO || anio > ANIO_MAXIMO) {
    return { cuerpo: null, desdeCache: false };
  }
  const clave = claveCachePublicacion(anio);
  const cacheado = await env.CACHE.get(clave);
  if (cacheado !== null)
    return { cuerpo: cacheado === SIN_DATOS ? null : cacheado, desdeCache: true };

  let cuerpo = await leerGuardada(env.DB, anio);
  if (cuerpo === null) {
    // Antes del primer cron: se calcula al vuelo y se guarda como preliminar.
    const generadoEn = ahora.toISOString();
    const p = await calcular(env.DB, anio, true, generadoEn, ahora);
    if (p) {
      cuerpo = JSON.stringify(p);
      await env.DB.prepare(SQL_GUARDAR_PRELIMINAR).bind(anio, cuerpo, generadoEn).run();
      await env.CACHE.delete(CLAVE_CACHE_ANIOS);
    }
  }
  await env.CACHE.put(clave, cuerpo ?? SIN_DATOS, { expirationTtl: TTL_CACHE_AGREGADOS_S });
  return { cuerpo, desdeCache: false };
}

export async function obtenerPublicacion(
  env: EnvPublico,
  anio: number,
  ahora: Date = new Date(),
): Promise<Publicacion | null> {
  const { cuerpo } = await obtenerPublicacionJson(env, anio, ahora);
  return cuerpo === null ? null : (JSON.parse(cuerpo) as Publicacion);
}

export interface AnioPublicado {
  anio: number;
  version: string;
  preliminar: boolean;
  generadoEn: string;
}

/**
 * Años con publicación (la versión que se sirve de cada uno), del más reciente al más antiguo.
 * Si la tabla está vacía (antes del primer cron) publica primero.
 */
export async function listarAniosPublicadosJson(
  env: EnvPublico,
  ahora: Date = new Date(),
): Promise<{ cuerpo: string; desdeCache: boolean }> {
  const cacheado = await env.CACHE.get(CLAVE_CACHE_ANIOS);
  if (cacheado !== null) return { cuerpo: cacheado, desdeCache: true };

  const leer = () =>
    env.DB.prepare(
      `SELECT anio, version, preliminar, generado_en FROM publicaciones
       ORDER BY anio DESC, (version = 'preliminar'), length(version) DESC, version DESC`,
    ).all<{ anio: number; version: string; preliminar: number; generado_en: string }>();
  let { results } = await leer();
  if (results.length === 0) {
    await publicarAnios(env, ahora);
    ({ results } = await leer());
  }
  const vistos = new Set<number>();
  const anios: AnioPublicado[] = [];
  for (const r of results) {
    if (vistos.has(r.anio)) continue;
    vistos.add(r.anio);
    anios.push({
      anio: Number(r.anio),
      version: r.version,
      preliminar: r.preliminar === 1,
      generadoEn: r.generado_en,
    });
  }
  const cuerpo = JSON.stringify({ anios });
  await env.CACHE.put(CLAVE_CACHE_ANIOS, cuerpo, { expirationTtl: TTL_CACHE_AGREGADOS_S });
  return { cuerpo, desdeCache: false };
}

export async function listarAniosPublicados(
  env: EnvPublico,
  ahora: Date = new Date(),
): Promise<AnioPublicado[]> {
  const { cuerpo } = await listarAniosPublicadosJson(env, ahora);
  return (JSON.parse(cuerpo) as { anios: AnioPublicado[] }).anios;
}
