/**
 * Generador determinista de respuestas sintéticas para desarrollar y probar el panel.
 * Sin datos reales: todo sale de un PRNG con semilla. Usado por scripts/seed-admin.ts y tests.
 */
import { listarMunicipios } from "../catalogo/geo";
import { obtenerInstrumento } from "../puntuacion/instrumentos";
import { puntuar } from "../puntuacion/puntuar";
import type { Escala } from "../puntuacion/tipos";

export interface FilaSintetica {
  id: string;
  creado_en: string;
  periodo_anio: number;
  departamento: string;
  municipio: string;
  edad_anios: number;
  sexo: "F" | "M" | "X";
  informante: "madre" | "padre" | "cuidador" | "docente";
  items: Record<string, number>;
  punt: Record<Escala, number | null>;
  pos: Record<Escala, 0 | 1>;
  nivel: string;
  consentimiento_investigacion: 0 | 1;
  version_consentimiento: string;
  version_instrumento: string;
  duracion_segundos: number | null;
  completado: 0 | 1;
  item_abandono: string | null;
}

/** PRNG mulberry32. */
export function crearAleatorio(semilla: number): () => number {
  let a = semilla >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function uuid(rand: () => number): string {
  const hex = "0123456789abcdef";
  let s = "";
  for (let i = 0; i < 32; i++) s += hex[Math.floor(rand() * 16)];
  return `${s.slice(0, 8)}-${s.slice(8, 12)}-4${s.slice(13, 16)}-a${s.slice(17, 20)}-${s.slice(20, 32)}`;
}

function elegir<T>(rand: () => number, opciones: readonly T[], pesos?: readonly number[]): T {
  if (!pesos) return opciones[Math.floor(rand() * opciones.length)] as T;
  const total = pesos.reduce((a, b) => a + b, 0);
  let r = rand() * total;
  for (let i = 0; i < opciones.length; i++) {
    r -= pesos[i] as number;
    if (r <= 0) return opciones[i] as T;
  }
  return opciones[opciones.length - 1] as T;
}

/** Pesos por departamento: concentrados en Francisco Morazán (08) y Cortés (05). */
const PESOS_DEPTO: Record<string, number> = {
  "08": 30,
  "05": 20,
  "01": 6,
  "03": 5,
  "18": 5,
  "07": 4,
  "16": 4,
  "12": 4,
  "15": 3,
  "02": 2,
  "04": 2,
  "06": 2,
  "09": 2,
  "10": 1,
  "11": 1,
  "13": 2,
  "14": 1,
  "17": 1,
};

export interface OpcionesSinteticas {
  n: number;
  semilla?: number;
  /** Años a cubrir con sus pesos, p. ej. { 2026: 5, 2025: 1 }. */
  anios?: Record<number, number>;
  /** Proporción con ítems Atento además de Vanderbilt (para pares DSM). */
  proporcionAtento?: number;
}

export function generarFilas(opciones: OpcionesSinteticas): FilaSintetica[] {
  const rand = crearAleatorio(opciones.semilla ?? 42);
  const anios = opciones.anios ?? { 2026: 1 };
  const proporcionAtento = opciones.proporcionAtento ?? 0.3;
  const vanderbilt = obtenerInstrumento("vanderbilt-padres-es-1.0");
  const atento = obtenerInstrumento("atento-0.1");
  const depts = Object.keys(PESOS_DEPTO);
  const pesosDepto = depts.map((d) => PESOS_DEPTO[d] as number);
  const filas: FilaSintetica[] = [];
  for (let i = 0; i < opciones.n; i++) {
    const anio = Number(elegir(rand, Object.keys(anios), Object.values(anios)));
    const mesMax = anio >= 2026 ? 10 : 12;
    const mes = 1 + Math.floor(rand() * mesMax);
    const dia = 1 + Math.floor(rand() * 28);
    const creado = `${anio}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
    const departamento = elegir(rand, depts, pesosDepto);
    const municipios = listarMunicipios(departamento);
    // La cabecera concentra más respuestas; el resto queda disperso (muchos con n < 5).
    const municipio =
      (rand() < 0.6 ? municipios[0] : elegir(rand, municipios))?.codigo ?? `${departamento}01`;
    const edad = 6 + Math.floor(rand() * 7);
    const sexo = elegir(rand, ["F", "M", "X"] as const, [47, 51, 2]);
    const informante = elegir(
      rand,
      ["madre", "padre", "cuidador", "docente"] as const,
      [60, 20, 12, 8],
    );
    // Perfil latente: ~15 % con rasgo alto, con más niños que niñas.
    const rasgo = rand() < (sexo === "M" ? 0.18 : 0.11) ? 0.75 : 0.18;
    const items: Record<string, number> = {};
    for (const item of vanderbilt.items) {
      if (item.tipo === "desempeno") {
        const p = rasgo > 0.5 ? 0.45 : 0.1;
        items[item.id] = rand() < p ? 4 + Math.floor(rand() * 2) : 1 + Math.floor(rand() * 3);
      } else {
        const nucleo = item.escala === "inatencion" || item.escala === "hiperactividad";
        const p = nucleo ? rasgo : rasgo * 0.4;
        items[item.id] = rand() < p ? 2 + Math.floor(rand() * 2) : Math.floor(rand() * 2);
      }
    }
    const conAtento = rand() < proporcionAtento;
    if (conAtento) {
      for (const item of atento.items) {
        const par = vanderbilt.items.find((v) => v.criterioDSM === item.criterioDSM);
        const base = par ? (items[par.id] as number) : 0;
        const ruido = rand() < 0.75 ? 0 : rand() < 0.5 ? -1 : 1;
        items[item.id] = Math.max(0, Math.min(3, base + ruido));
      }
    }
    const completado = rand() < 0.92 ? 1 : 0;
    const itemAbandono = completado
      ? null
      : elegir(rand, ["V03", "V12", "V20", "V31", "V48"], [3, 2, 2, 3, 1]);
    const respuestasV: Record<string, number> = {};
    for (const item of vanderbilt.items) respuestasV[item.id] = items[item.id] as number;
    const resultado = puntuar({ instrumentoId: vanderbilt.id, respuestas: respuestasV });
    const punt = {} as Record<Escala, number | null>;
    const pos = {} as Record<Escala, 0 | 1>;
    for (const [escala, r] of Object.entries(resultado.escalas)) {
      punt[escala as Escala] = completado ? r.puntaje : null;
      pos[escala as Escala] = completado && r.positivo ? 1 : 0;
    }
    const todoIgual = rand() < 0.02;
    if (todoIgual)
      for (const k of Object.keys(items))
        if (!k.startsWith("V4") && !k.startsWith("V5")) items[k] = 1;
    filas.push({
      id: uuid(rand),
      creado_en: creado,
      periodo_anio: anio,
      departamento,
      municipio,
      edad_anios: edad,
      sexo,
      informante,
      items: completado ? items : Object.fromEntries(Object.entries(items).slice(0, 10)),
      punt,
      pos,
      nivel: completado ? resultado.nivel : "bajo",
      consentimiento_investigacion: rand() < 0.65 ? 1 : 0,
      version_consentimiento: "2026-10-11",
      version_instrumento: conAtento ? "vanderbilt-padres-es-1.0+atento-0.1" : vanderbilt.id,
      duracion_segundos:
        rand() < 0.05
          ? null
          : rand() < 0.06
            ? 40 + Math.floor(rand() * 70)
            : 180 + Math.floor(rand() * 900),
      completado,
      item_abandono: itemAbandono,
    });
  }
  // Un par de duplicados sospechosos para el reporte de calidad.
  const base = filas[0];
  if (base && filas.length > 10) {
    filas.push({ ...base, id: uuid(rand) });
  }
  return filas;
}

const ESCALAS: Escala[] = [
  "inatencion",
  "hiperactividad",
  "oposicion",
  "conducta",
  "ansiedad_depresion",
  "desempeno",
];

export const COLUMNAS_INSERT = [
  "id",
  "creado_en",
  "periodo_anio",
  "departamento",
  "municipio",
  "edad_anios",
  "sexo",
  "informante",
  "items",
  ...ESCALAS.map((e) => `punt_${e}`),
  ...ESCALAS.map((e) => `pos_${e}`),
  "nivel",
  "consentimiento_investigacion",
  "version_consentimiento",
  "version_instrumento",
  "duracion_segundos",
  "completado",
  "item_abandono",
] as const;

/** Valores en el orden de COLUMNAS_INSERT, listos para `bind(...)`. */
export function valoresInsert(f: FilaSintetica): (string | number | null)[] {
  return [
    f.id,
    f.creado_en,
    f.periodo_anio,
    f.departamento,
    f.municipio,
    f.edad_anios,
    f.sexo,
    f.informante,
    JSON.stringify(f.items),
    ...ESCALAS.map((e) => f.punt[e]),
    ...ESCALAS.map((e) => f.pos[e]),
    f.nivel,
    f.consentimiento_investigacion,
    f.version_consentimiento,
    f.version_instrumento,
    f.duracion_segundos,
    f.completado,
    f.item_abandono,
  ];
}

export const SQL_INSERT = `INSERT INTO respuestas (${COLUMNAS_INSERT.join(", ")}) VALUES (${COLUMNAS_INSERT.map(() => "?").join(", ")})`;

function literalSql(v: string | number | null): string {
  if (v === null) return "NULL";
  if (typeof v === "number") return String(v);
  return `'${v.replace(/'/g, "''")}'`;
}

/** Sentencias INSERT en texto (para `wrangler d1 execute --file`). */
export function filasASql(filas: readonly FilaSintetica[]): string {
  const lineas = filas.map(
    (f) =>
      `INSERT INTO respuestas (${COLUMNAS_INSERT.join(", ")}) VALUES (${valoresInsert(f).map(literalSql).join(", ")});`,
  );
  return `${lineas.join("\n")}\n`;
}
