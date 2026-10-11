/**
 * Exportaciones: CSV/JSON de agregados, microdatos anonimizados y codebook.
 *
 * Microdatos (solo rol admin): únicamente respuestas con consentimiento de investigación;
 * municipio recodificado a departamento cuando ese municipio tiene n < 5 en el conjunto
 * exportado; fecha reducida a mes; ítems expandidos a columnas V01..V54 y A01..A18.
 */
import { listarInstrumentos, obtenerInstrumento } from "../puntuacion/instrumentos";
import { consultar, type Db, ESCALAS_TODAS, parsearItems, where } from "./comun";
import type { Filtros } from "./filtros";
import type { NombreReporte } from "./index";
import { UMBRAL_SUPRESION } from "./supresion";

export type Fila = Record<string, string | number | boolean | null>;

/** Aplana un objeto anidado a claves snake_case con guion bajo como separador. */
export function aplanar(valor: unknown, prefijo = "", salida: Fila = {}): Fila {
  if (valor === null || valor === undefined) {
    if (prefijo) salida[prefijo] = null;
    return salida;
  }
  if (Array.isArray(valor)) {
    valor.forEach((v, i) => {
      aplanar(v, prefijo ? `${prefijo}_${i}` : String(i), salida);
    });
    return salida;
  }
  if (typeof valor === "object") {
    for (const [k, v] of Object.entries(valor as Record<string, unknown>)) {
      aplanar(v, prefijo ? `${prefijo}_${k}` : k, salida);
    }
    return salida;
  }
  salida[prefijo] = valor as string | number | boolean;
  return salida;
}

function escaparCsv(valor: string | number | boolean | null): string {
  if (valor === null || valor === undefined) return "";
  if (typeof valor === "number") return String(valor);
  if (typeof valor === "boolean") return valor ? "1" : "0";
  const texto = String(valor);
  return /[",\n\r]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto;
}

/** CSV UTF-8 con BOM, separador coma y cabeceras en el orden dado (o la unión de claves). */
export function aCsv(filas: readonly Fila[], columnas?: readonly string[]): string {
  const cols = columnas ?? [...new Set(filas.flatMap((f) => Object.keys(f)))];
  const lineas = [cols.join(",")];
  for (const f of filas) lineas.push(cols.map((c) => escaparCsv(f[c] ?? null)).join(","));
  return `﻿${lineas.join("\r\n")}\r\n`;
}

/** Tabla principal de cada reporte, como filas planas, para el CSV de agregados. */
export function filasDeReporte(nombre: NombreReporte, datos: unknown): Fila[] {
  const d = datos as Record<string, unknown>;
  const lista = (clave: string): unknown[] =>
    Array.isArray(d[clave]) ? (d[clave] as unknown[]) : [];
  const conTipo = (tipo: string, filas: unknown[]) =>
    filas.map((f) => ({ tabla: tipo, ...aplanar(f) }));
  switch (nombre) {
    case "resumen":
      return [aplanar({ ...d, ultimos30: undefined })];
    case "volumen":
      return [...conTipo("serie", lista("series")), ...conTipo("abandono", lista("itemsAbandono"))];
    case "geografia":
      return [
        ...conTipo("departamento", lista("departamentos")),
        ...conTipo("municipio", lista("municipios")),
      ];
    case "demografia":
      return [
        ...conTipo("edad", lista("porEdad")),
        ...conTipo("sexo", lista("porSexo")),
        ...conTipo("informante", lista("porInformante")),
      ];
    case "puntajes":
      return [
        ...lista("escalas").map((e) => {
          const { histograma: _h, ...resto } = e as Record<string, unknown>;
          return { tabla: "escala", ...aplanar(resto) };
        }),
        ...conTipo("nivel", lista("niveles")),
      ];
    case "comorbilidad": {
      const pct = (d.pct ?? {}) as Record<string, Record<string, unknown>>;
      return Object.entries(pct).map(([a, fila]) => ({ escala: a, ...aplanar(fila) }));
    }
    case "desempeno":
      return conTipo("item", lista("items"));
    case "psicometria":
      return lista("instrumentos").flatMap((i) => {
        const inst = i as { id: string; items: unknown[]; escalas: unknown[] };
        return [
          ...inst.items.map((it) => ({ tabla: "item", instrumento: inst.id, ...aplanar(it) })),
          ...inst.escalas.map((e) => ({ tabla: "escala", instrumento: inst.id, ...aplanar(e) })),
        ];
      });
    case "calidad":
      return [aplanar(d)];
    case "investigacion":
      return conTipo("perfil", lista("perfiles"));
    case "historico":
      return [...conTipo("mensual", lista("mensual")), ...conTipo("anual", lista("anual"))];
  }
}

export const COLUMNAS_ITEMS: readonly string[] = listarInstrumentos().flatMap((id) =>
  obtenerInstrumento(id).items.map((i) => i.id),
);

export const COLUMNAS_MICRODATOS: readonly string[] = [
  "id",
  "mes",
  "periodo_anio",
  "departamento",
  "municipio",
  "municipio_recodificado",
  "edad_anios",
  "sexo",
  "informante",
  "version_instrumento",
  "version_consentimiento",
  "duracion_segundos",
  ...ESCALAS_TODAS.map((e) => `punt_${e}`),
  ...ESCALAS_TODAS.map((e) => `pos_${e}`),
  "nivel",
  ...COLUMNAS_ITEMS,
];

interface FilaMicro {
  id: string;
  creado_en: string;
  periodo_anio: number;
  departamento: string;
  municipio: string;
  edad_anios: number;
  sexo: string | null;
  informante: string | null;
  items: string;
  nivel: string | null;
  version_consentimiento: string;
  version_instrumento: string;
  duracion_segundos: number | null;
  [k: string]: string | number | null;
}

/** Microdatos anonimizados (solo con consentimiento), listos para CSV o JSON. */
export async function exportarMicrodatos(db: Db, filtros: Filtros): Promise<Fila[]> {
  const w = where({ ...filtros, soloConsentimiento: true });
  const filas = await consultar<FilaMicro>(
    db,
    `SELECT id, creado_en, periodo_anio, departamento, municipio, edad_anios, sexo, informante,
       items, nivel, version_consentimiento, version_instrumento, duracion_segundos,
       ${ESCALAS_TODAS.map((e) => `punt_${e}, pos_${e}`).join(", ")}
     FROM respuestas ${w.sql} ORDER BY creado_en, id`,
    w.params,
  );
  const porMunicipio = new Map<string, number>();
  for (const f of filas) porMunicipio.set(f.municipio, (porMunicipio.get(f.municipio) ?? 0) + 1);
  return filas.map((f) => {
    const recodificar = (porMunicipio.get(f.municipio) ?? 0) < UMBRAL_SUPRESION;
    const items = parsearItems(f.items);
    const salida: Fila = {
      id: f.id,
      mes: f.creado_en.slice(0, 7),
      periodo_anio: f.periodo_anio,
      departamento: f.departamento,
      municipio: recodificar ? null : f.municipio,
      municipio_recodificado: recodificar ? 1 : 0,
      edad_anios: f.edad_anios,
      sexo: f.sexo,
      informante: f.informante,
      version_instrumento: f.version_instrumento,
      version_consentimiento: f.version_consentimiento,
      duracion_segundos: f.duracion_segundos,
      nivel: f.nivel,
    };
    for (const e of ESCALAS_TODAS) {
      salida[`punt_${e}`] = f[`punt_${e}`] ?? null;
      salida[`pos_${e}`] = f[`pos_${e}`] ?? null;
    }
    for (const id of COLUMNAS_ITEMS) salida[id] = items[id] ?? null;
    return salida;
  });
}

/** Codebook en Markdown generado desde el esquema y los instrumentos registrados. */
export function generarCodebook(): string {
  const lineas: string[] = [];
  lineas.push("# Codebook de microdatos de Atento");
  lineas.push("");
  lineas.push(
    `Generado: ${new Date().toISOString().slice(0, 10)}. Cribado comunitario, no diagnóstico.`,
  );
  lineas.push(
    "Solo incluye respuestas con consentimiento de investigación. Una fila por cribado completado.",
  );
  lineas.push(
    `Anonimización: sin fecha exacta (solo mes); municipio en blanco y \`municipio_recodificado = 1\` cuando el municipio tiene menos de ${UMBRAL_SUPRESION} filas en el archivo.`,
  );
  lineas.push("");
  lineas.push("## Variables generales");
  lineas.push("");
  lineas.push("| Variable | Tipo | Valores | Etiqueta |");
  lineas.push("|---|---|---|---|");
  const generales: Array<[string, string, string, string]> = [
    ["id", "texto (UUID)", "", "Identificador aleatorio de la respuesta"],
    ["mes", "texto", "AAAA-MM", "Mes en que se completó el cuestionario"],
    ["periodo_anio", "entero", "2026, 2027...", "Año calendario (periodo canónico)"],
    ["departamento", "texto", "01-18 (código INE)", "Departamento de residencia"],
    ["municipio", "texto", "4 dígitos (código INE) o vacío", "Municipio (vacío si recodificado)"],
    ["municipio_recodificado", "entero", "0/1", "1 = municipio suprimido por n < 5"],
    ["edad_anios", "entero", "6-12", "Edad del niño o niña"],
    ["sexo", "texto", "F, M, X", "Sexo declarado por el informante"],
    ["informante", "texto", "madre, padre, cuidador, docente", "Quién responde"],
    ["version_instrumento", "texto", listarInstrumentos().join(", "), "Instrumento aplicado"],
    ["version_consentimiento", "texto", "", "Versión del texto de consentimiento aceptado"],
    ["duracion_segundos", "entero o vacío", ">= 0", "Tiempo de llenado"],
    ["nivel", "texto", "bajo, moderado, alto", "Nivel orientativo de Atento (regla propia)"],
  ];
  for (const g of generales) lineas.push(`| ${g.join(" | ")} |`);
  for (const e of ESCALAS_TODAS) {
    lineas.push(`| punt_${e} | entero | suma de ítems | Puntaje de la escala ${e} |`);
    lineas.push(`| pos_${e} | entero | 0/1 | Escala ${e} positiva según umbral del instrumento |`);
  }
  lineas.push("");
  lineas.push(
    'Definiciones: "cribado positivo" = pos_inatencion = 1 o pos_hiperactividad = 1; "combinado" = ambas.',
  );
  for (const id of listarInstrumentos()) {
    const inst = obtenerInstrumento(id);
    lineas.push("");
    lineas.push(
      `## Ítems de ${inst.nombre} (\`${inst.id}\`, versión ${inst.version}, ${inst.fecha})`,
    );
    lineas.push("");
    const frec = inst.opcionesFrecuencia.map((o) => `${o.valor} = ${o.etiqueta}`).join("; ");
    const des = inst.opcionesDesempeno.map((o) => `${o.valor} = ${o.etiqueta}`).join("; ");
    lineas.push(`Frecuencia: ${frec}. Desempeño: ${des}. Vacío = sin respuesta.`);
    lineas.push("");
    lineas.push("| Variable | Tipo | Valores | Escala | Criterio DSM-5 | Etiqueta |");
    lineas.push("|---|---|---|---|---|---|");
    for (const it of inst.items) {
      const valores = it.tipo === "desempeno" ? "1-5" : "0-3";
      lineas.push(
        `| ${it.id} | entero | ${valores} | ${it.escala} | ${it.criterioDSM ?? ""} | ${it.texto.replace(/\|/g, "/")} |`,
      );
    }
  }
  lineas.push("");
  lineas.push(
    "Licencia de microdatos: uso bajo acuerdo con el socio académico. Contacto: info@galexbh.dev",
  );
  return `${lineas.join("\n")}\n`;
}

export function nombreArchivo(tipo: string, periodo: string, formato: string): string {
  const fecha = new Date().toISOString().slice(0, 10);
  return `atento-${tipo}-${periodo}-${fecha}.${formato}`;
}
