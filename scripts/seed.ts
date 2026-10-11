/**
 * Genera respuestas sintéticas realistas y las inserta en la D1 local.
 *
 *   pnpm seed -- --n 2000 [--semilla 42] [--solo-sql]
 *
 * - Municipios ponderados por población aproximada de cada departamento (cabecera con más peso).
 * - ~8 % de cribados positivos (inatención y/o hiperactividad) con comorbilidad plausible
 *   (oposición/conducta más frecuentes en el grupo hiperactivo; desempeño afectado en positivos).
 * - Edades 6–12 (más 7–10), sexo F/M (~1 % X), informante madre 60 % / padre 20 % / cuidador 10 %
 *   / docente 10 %, consentimiento de investigación 70 %, fechas repartidas en los últimos 12 meses,
 *   ~3 % incompletos, versión `vanderbilt-padres-es-1.0`.
 * - Determinista: misma semilla -> mismos ids (UUID v4 derivados del PRNG) -> `INSERT OR IGNORE`
 *   hace que repetir el comando sea idempotente.
 *
 * Escribe `.wrangler/seed.sql` y lo ejecuta con `wrangler d1 execute atento-db --local --file`.
 * Requiere `pnpm db:migrate:local` previo. Después: `pnpm agregar:local`.
 */
import { execSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { literalSql } from "../src/lib/agregados/sql";
import { listarDepartamentos, listarMunicipios } from "../src/lib/catalogo/geo";
import {
  COLUMNAS_RESPUESTA,
  construirFila,
  type FilaRespuestaNueva,
} from "../src/lib/db/respuestas";
import { INSTRUMENTO_ACTUAL, obtenerInstrumento } from "../src/lib/puntuacion/instrumentos";
import type { Envio } from "../src/lib/validacion/respuesta";

// ---------- argumentos ----------
const args = process.argv.slice(2);
function arg(nombre: string, porDefecto: string): string {
  const i = args.indexOf(`--${nombre}`);
  return i >= 0 && args[i + 1] !== undefined ? (args[i + 1] as string) : porDefecto;
}
const N = Number.parseInt(arg("n", "500"), 10);
const SEMILLA = Number.parseInt(arg("semilla", "42"), 10);
const SOLO_SQL = args.includes("--solo-sql");
const ARCHIVO = arg("archivo", ".wrangler/seed.sql");
if (!Number.isFinite(N) || N <= 0) throw new Error("--n debe ser un entero positivo");

// ---------- PRNG determinista (mulberry32) ----------
function crearRng(semilla: number) {
  let a = semilla >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rnd = crearRng(SEMILLA);

function elegirPonderado<T>(items: readonly T[], pesos: readonly number[]): T {
  const total = pesos.reduce((s, p) => s + p, 0);
  let r = rnd() * total;
  for (let i = 0; i < items.length; i++) {
    r -= pesos[i] as number;
    if (r <= 0) return items[i] as T;
  }
  return items[items.length - 1] as T;
}

function uuidV4(): string {
  const b = new Uint8Array(16);
  for (let i = 0; i < 16; i++) b[i] = Math.floor(rnd() * 256);
  b[6] = ((b[6] as number) & 0x0f) | 0x40;
  b[8] = ((b[8] as number) & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

// ---------- geografía ponderada (población aproximada 2023, miles) ----------
const POBLACION_DEPTO: Record<string, number> = {
  "01": 500,
  "02": 350,
  "03": 550,
  "04": 420,
  "05": 1800,
  "06": 470,
  "07": 500,
  "08": 1700,
  "09": 110,
  "10": 270,
  "11": 80,
  "12": 220,
  "13": 370,
  "14": 170,
  "15": 600,
  "16": 470,
  "17": 190,
  "18": 650,
};
const departamentos = listarDepartamentos();
const pesosDepto = departamentos.map((d) => POBLACION_DEPTO[d.codigo] ?? 100);

function elegirMunicipio(): { departamento: string; municipio: string } {
  const depto = elegirPonderado(departamentos, pesosDepto);
  const municipios = listarMunicipios(depto.codigo);
  // Cabecera (xx01) con peso 4; el resto decreciente suave.
  const pesos = municipios.map((_, i) => (i === 0 ? 4 : 1.5 - i / municipios.length));
  const m = elegirPonderado(municipios, pesos);
  return { departamento: depto.codigo, municipio: m.codigo };
}

// ---------- perfiles de riesgo ----------
type Perfil = "bajo" | "inatencion" | "hiperactividad" | "ambas";
const PERFILES: Perfil[] = ["bajo", "inatencion", "hiperactividad", "ambas"];
const PESOS_PERFIL = [92, 4, 2, 2];

/** Distribución de un ítem de frecuencia (0–3) según intensidad. */
function valorFrecuencia(intensidad: "baja" | "media" | "alta"): number {
  const dist =
    intensidad === "alta"
      ? [0.05, 0.2, 0.4, 0.35]
      : intensidad === "media"
        ? [0.3, 0.4, 0.22, 0.08]
        : [0.55, 0.32, 0.1, 0.03];
  return elegirPonderado([0, 1, 2, 3], dist);
}

function valorDesempeno(afectado: boolean): number {
  return afectado
    ? elegirPonderado([1, 2, 3, 4, 5], [0.05, 0.15, 0.3, 0.35, 0.15])
    : elegirPonderado([1, 2, 3, 4, 5], [0.35, 0.35, 0.22, 0.06, 0.02]);
}

const instrumento = obtenerInstrumento(INSTRUMENTO_ACTUAL);

function generarRespuestas(perfil: Perfil): Record<string, number> {
  const ina = perfil === "inatencion" || perfil === "ambas";
  const hip = perfil === "hiperactividad" || perfil === "ambas";
  const desempenoAfectado = (ina || hip) && rnd() < 0.55;
  // Comorbilidad: oposición/conducta más probables con hiperactividad; ansiedad con inatención.
  const oposicion = hip ? rnd() < 0.45 : rnd() < 0.06;
  const conducta = hip ? rnd() < 0.2 : rnd() < 0.02;
  const ansiedad = ina ? rnd() < 0.3 : rnd() < 0.08;
  const r: Record<string, number> = {};
  for (const item of instrumento.items) {
    if (item.tipo === "desempeno") {
      r[item.id] = valorDesempeno(desempenoAfectado);
      continue;
    }
    let intensidad: "baja" | "media" | "alta" = "baja";
    switch (item.escala) {
      case "inatencion":
        intensidad = ina ? "alta" : hip ? "media" : "baja";
        break;
      case "hiperactividad":
        intensidad = hip ? "alta" : ina ? "media" : "baja";
        break;
      case "oposicion":
        intensidad = oposicion ? "alta" : "baja";
        break;
      case "conducta":
        intensidad = conducta ? "media" : "baja";
        break;
      case "ansiedad_depresion":
        intensidad = ansiedad ? "alta" : "baja";
        break;
      default:
        intensidad = "baja";
    }
    r[item.id] = valorFrecuencia(intensidad);
  }
  return r;
}

// ---------- fechas: últimos 12 meses ----------
const HOY = new Date();
function fechaAleatoria(): Date {
  const dias = Math.floor(rnd() * 365);
  const d = new Date(Date.UTC(HOY.getUTCFullYear(), HOY.getUTCMonth(), HOY.getUTCDate()));
  d.setUTCDate(d.getUTCDate() - dias);
  return d;
}

// ---------- generación ----------
function generarFila(): FilaRespuestaNueva {
  const perfil = elegirPonderado(PERFILES, PESOS_PERFIL);
  const geo = elegirMunicipio();
  const completado = rnd() >= 0.03;
  let respuestas = generarRespuestas(perfil);
  let itemAbandono: string | undefined;
  if (!completado) {
    const corte = 10 + Math.floor(rnd() * (instrumento.items.length - 12));
    const ids = instrumento.items.map((i) => i.id);
    itemAbandono = ids[corte];
    respuestas = Object.fromEntries(
      ids.slice(0, corte).map((id) => [id, respuestas[id] as number]),
    );
  }
  const envio: Envio = {
    id: uuidV4(),
    instrumentoId: INSTRUMENTO_ACTUAL,
    respuestas,
    departamento: geo.departamento,
    municipio: geo.municipio,
    edadAnios: elegirPonderado([6, 7, 8, 9, 10, 11, 12], [10, 17, 18, 18, 16, 12, 9]),
    sexo: elegirPonderado(["F", "M", "X"] as const, [49, 50, 1]),
    informante: elegirPonderado(
      ["madre", "padre", "cuidador", "docente"] as const,
      [60, 20, 10, 10],
    ),
    consentimientoInvestigacion: rnd() < 0.7,
    versionConsentimiento: "v1",
    duracionSegundos: Math.round(240 + rnd() * 600 + rnd() * 300),
    completado,
    turnstileToken: "semilla",
    hp: "",
  };
  if (itemAbandono) envio.itemAbandono = itemAbandono;
  return construirFila(envio, fechaAleatoria());
}

const filas: FilaRespuestaNueva[] = [];
for (let i = 0; i < N; i++) filas.push(generarFila());

const columnas = COLUMNAS_RESPUESTA.join(", ");
const sentencias: string[] = [];
const POR_SENTENCIA = 50;
for (let i = 0; i < filas.length; i += POR_SENTENCIA) {
  const grupo = filas.slice(i, i + POR_SENTENCIA);
  const valores = grupo
    .map((f) => `(${COLUMNAS_RESPUESTA.map((c) => literalSql(f[c])).join(", ")})`)
    .join(",\n");
  sentencias.push(`INSERT OR IGNORE INTO respuestas (${columnas}) VALUES\n${valores};`);
}
mkdirSync(".wrangler", { recursive: true });
writeFileSync(
  ARCHIVO,
  `-- Semilla sintética Atento: n=${N}, semilla=${SEMILLA}\n${sentencias.join("\n")}\n`,
);

const positivos = filas.filter((f) => f.pos_inatencion === 1 || f.pos_hiperactividad === 1).length;
const porNivel = { bajo: 0, moderado: 0, alto: 0 };
for (const f of filas) porNivel[f.nivel] += 1;
console.log(
  `Generadas ${filas.length} respuestas en ${ARCHIVO}: ${positivos} con indicadores (${((100 * positivos) / filas.length).toFixed(1)} %), niveles ${JSON.stringify(porNivel)}, ${filas.filter((f) => f.completado === 0).length} incompletas.`,
);

if (!SOLO_SQL) {
  execSync(`pnpm exec wrangler d1 execute atento-db --local --file ${ARCHIVO}`, {
    stdio: "inherit",
  });
  console.log("Insertadas en la D1 local. Ahora: pnpm agregar:local");
}
