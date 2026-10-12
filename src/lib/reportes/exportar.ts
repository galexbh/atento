/**
 * Exportaciones: CSV/JSON de agregados, microdatos anonimizados y codebook.
 *
 * Microdatos (solo rol admin): únicamente respuestas con consentimiento de investigación;
 * municipio recodificado a departamento cuando ese municipio tiene n < 5 en el conjunto
 * exportado; fecha reducida a mes; ítems expandidos a columnas V01..V54, A01..A18 y T01..T43
 * (versión docente). El código de vínculo NUNCA se exporta: en su lugar va `par_id`, un HMAC del
 * código con la misma clave por descarga que seudonimiza `id` (vacío si no hay código), que
 * permite emparejar familia y docente dentro de un mismo archivo pero no entre descargas.
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

/**
 * Escapa un valor para CSV. Además de comillas, comas y saltos de línea, neutraliza la inyección
 * de fórmulas en hojas de cálculo: si el texto empieza por `=`, `+`, `-`, `@`, TAB o CR se
 * antepone una comilla simple (la hoja lo trata como texto; el valor se conserva íntegro).
 */
export function escaparCsv(valor: string | number | boolean | null): string {
  if (valor === null || valor === undefined) return "";
  if (typeof valor === "number") return String(valor);
  if (typeof valor === "boolean") return valor ? "1" : "0";
  let texto = String(valor);
  if (/^[=+\-@\t\r]/.test(texto)) texto = `'${texto}`;
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
    case "concordancia":
      return [
        ...conTipo("acuerdo", lista("acuerdo")),
        ...conTipo("correlacion", lista("correlacion")),
        {
          tabla: "resumen",
          ...aplanar({
            pares: d.pares,
            dosEntornos: d.dosEntornos,
            docentesSinCodigo: d.docentesSinCodigo,
          }),
        },
      ];
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
  "edad_tramo",
  "sexo",
  "informante",
  "k_generalizado",
  "version_instrumento",
  "version_consentimiento",
  "duracion_segundos",
  "par_id",
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
  codigo_vinculo: string | null;
  [k: string]: string | number | null;
}

/**
 * Filtros admitidos en microdatos: solo periodo anual o `acumulado`, departamento y versión del
 * instrumento. Cualquier filtro fino (municipio, edad, sexo, informante, mes/trimestre) permitiría
 * aislar a una persona y se rechaza. Devuelve el motivo o null si los filtros son válidos.
 */
export function validarFiltrosMicrodatos(filtros: Filtros): string | null {
  if (!(filtros.periodo === "acumulado" || /^\d{4}$/.test(filtros.periodo))) {
    return "microdatos: el periodo debe ser un año (AAAA) o 'acumulado'";
  }
  const prohibidos: Array<[keyof Filtros, string]> = [
    ["municipio", "municipio"],
    ["edadMin", "edadMin"],
    ["edadMax", "edadMax"],
    ["sexo", "sexo"],
    ["informante", "informante"],
  ];
  const presentes = prohibidos.filter(([k]) => filtros[k] !== undefined).map(([, n]) => n);
  if (presentes.length > 0) {
    return `microdatos: los filtros ${presentes.join(", ")} no están permitidos (riesgo de reidentificación); usa departamento, versionInstrumento y periodo anual o acumulado`;
  }
  return null;
}

/** Tramos de edad usados al generalizar (k-anonimato). */
export function tramoEdad(edad: number): "6-8" | "9-10" | "11-12" {
  if (edad <= 8) return "6-8";
  if (edad <= 10) return "9-10";
  return "11-12";
}

/** HMAC-SHA256 truncado a 16 hex; la clave incluye la fecha para que no se crucen descargas. */
export async function seudonimizarId(id: string, secreto: string, fecha: string): Promise<string> {
  const codificador = new TextEncoder();
  const clave = await crypto.subtle.importKey(
    "raw",
    codificador.encode(`${secreto}:${fecha}`),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const firma = new Uint8Array(await crypto.subtle.sign("HMAC", clave, codificador.encode(id)));
  return [...firma.slice(0, 8)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export interface OpcionesMicrodatos {
  /** Secreto para el HMAC del id (ADMIN_SESSION_SECRET). */
  secreto: string;
  /** Fecha de descarga AAAA-MM-DD (entra en la clave del HMAC). */
  fecha: string;
}

interface Universo {
  municipio: Map<string, number>;
  cruce: Map<string, number>;
  cruceTramo: Map<string, number>;
}

const claveCruce = (d: string, edad: string | number, s: string | null, i: string | null) =>
  `${d}|${edad}|${s ?? ""}|${i ?? ""}`;

/**
 * Conteos del universo completo del periodo (todas las respuestas completadas, con o sin
 * consentimiento y sin los filtros del usuario): es la referencia para suprimir municipios y
 * cruces pequeños, de modo que filtrar no permita bajar el umbral.
 */
async function universoPeriodo(db: Db, periodo: string): Promise<Universo> {
  const w = where({ periodo, soloConsentimiento: false });
  const filas = await consultar<{
    departamento: string;
    municipio: string;
    edad_anios: number;
    sexo: string | null;
    informante: string | null;
    n: number;
  }>(
    db,
    `SELECT departamento, municipio, edad_anios, sexo, informante, COUNT(*) AS n
     FROM respuestas ${w.sql} GROUP BY departamento, municipio, edad_anios, sexo, informante`,
    w.params,
  );
  const u: Universo = { municipio: new Map(), cruce: new Map(), cruceTramo: new Map() };
  const sumar = (m: Map<string, number>, k: string, n: number) => m.set(k, (m.get(k) ?? 0) + n);
  for (const f of filas) {
    sumar(u.municipio, f.municipio, f.n);
    sumar(u.cruce, claveCruce(f.departamento, f.edad_anios, f.sexo, f.informante), f.n);
    sumar(
      u.cruceTramo,
      claveCruce(f.departamento, tramoEdad(f.edad_anios), f.sexo, f.informante),
      f.n,
    );
  }
  return u;
}

/**
 * Microdatos anonimizados (solo con consentimiento), listos para CSV o JSON.
 *
 * - `id` se sustituye por un seudónimo HMAC distinto en cada fecha de descarga.
 * - `codigo_vinculo` no se exporta; `par_id` = HMAC del código (misma clave por descarga) o vacío.
 * - municipio en blanco (`municipio_recodificado = 1`) si tiene n < 5 en el universo del periodo.
 * - k-anonimato sobre (departamento, edad, sexo, informante) en el universo del periodo: si n < 5,
 *   la edad pasa a tramo (`edad_anios` en blanco, `k_generalizado = 1`); si el cruce con tramo
 *   sigue en n < 5, además `sexo` e `informante` quedan en blanco (`k_generalizado = 2`).
 */
export async function exportarMicrodatos(
  db: Db,
  filtros: Filtros,
  opciones: OpcionesMicrodatos,
): Promise<Fila[]> {
  const motivo = validarFiltrosMicrodatos(filtros);
  if (motivo) throw new Error(motivo);
  const w = where({ ...filtros, soloConsentimiento: true });
  const [filas, universo] = await Promise.all([
    consultar<FilaMicro>(
      db,
      `SELECT id, creado_en, periodo_anio, departamento, municipio, edad_anios, sexo, informante,
       items, nivel, version_consentimiento, version_instrumento, duracion_segundos, codigo_vinculo,
       ${ESCALAS_TODAS.map((e) => `punt_${e}, pos_${e}`).join(", ")}
     FROM respuestas ${w.sql} ORDER BY creado_en, id`,
      w.params,
    ),
    universoPeriodo(db, filtros.periodo),
  ]);
  const salidas: Fila[] = [];
  for (const f of filas) {
    const recodificar = (universo.municipio.get(f.municipio) ?? 0) < UMBRAL_SUPRESION;
    const tramo = tramoEdad(f.edad_anios);
    let k = 0;
    if (
      (universo.cruce.get(claveCruce(f.departamento, f.edad_anios, f.sexo, f.informante)) ?? 0) <
      UMBRAL_SUPRESION
    ) {
      k = 1;
      if (
        (universo.cruceTramo.get(claveCruce(f.departamento, tramo, f.sexo, f.informante)) ?? 0) <
        UMBRAL_SUPRESION
      ) {
        k = 2;
      }
    }
    const items = parsearItems(f.items);
    const salida: Fila = {
      id: await seudonimizarId(f.id, opciones.secreto, opciones.fecha),
      mes: f.creado_en.slice(0, 7),
      periodo_anio: f.periodo_anio,
      departamento: f.departamento,
      municipio: recodificar ? null : f.municipio,
      municipio_recodificado: recodificar ? 1 : 0,
      edad_anios: k >= 1 ? null : f.edad_anios,
      edad_tramo: tramo,
      sexo: k >= 2 ? null : f.sexo,
      informante: k >= 2 ? null : f.informante,
      k_generalizado: k,
      version_instrumento: f.version_instrumento,
      version_consentimiento: f.version_consentimiento,
      duracion_segundos: f.duracion_segundos,
      par_id: f.codigo_vinculo
        ? await seudonimizarId(f.codigo_vinculo.toUpperCase(), opciones.secreto, opciones.fecha)
        : null,
      nivel: f.nivel,
    };
    for (const e of ESCALAS_TODAS) {
      salida[`punt_${e}`] = f[`punt_${e}`] ?? null;
      salida[`pos_${e}`] = f[`pos_${e}`] ?? null;
    }
    for (const id of COLUMNAS_ITEMS) salida[id] = items[id] ?? null;
    salidas.push(salida);
  }
  return salidas;
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
    `Anonimización: sin fecha exacta (solo mes); \`id\` es un seudónimo HMAC distinto en cada descarga (no permite cruzar archivos); municipio en blanco y \`municipio_recodificado = 1\` cuando el municipio tiene menos de ${UMBRAL_SUPRESION} respuestas completadas en el periodo exportado (universo completo, no solo el archivo).`,
  );
  lineas.push(
    `K-anonimato: si el cruce (departamento, edad, sexo, informante) tiene menos de ${UMBRAL_SUPRESION} respuestas en el periodo, \`edad_anios\` queda en blanco y solo se conserva \`edad_tramo\` (\`k_generalizado = 1\`); si el cruce con el tramo sigue por debajo del umbral, también \`sexo\` e \`informante\` quedan en blanco (\`k_generalizado = 2\`).`,
  );
  lineas.push(
    "Filtros admitidos al exportar: periodo anual o acumulado, departamento y versión del instrumento (municipio, edad, sexo, informante y periodos mensuales o trimestrales se rechazan).",
  );
  lineas.push("");
  lineas.push("## Variables generales");
  lineas.push("");
  lineas.push("| Variable | Tipo | Valores | Etiqueta |");
  lineas.push("|---|---|---|---|");
  const generales: Array<[string, string, string, string]> = [
    ["id", "texto (16 hex)", "", "Seudónimo HMAC-SHA256 truncado; cambia en cada descarga"],
    ["mes", "texto", "AAAA-MM", "Mes en que se completó el cuestionario"],
    ["periodo_anio", "entero", "2026, 2027...", "Año calendario (periodo canónico)"],
    ["departamento", "texto", "01-18 (código INE)", "Departamento de residencia"],
    ["municipio", "texto", "4 dígitos (código INE) o vacío", "Municipio (vacío si recodificado)"],
    ["municipio_recodificado", "entero", "0/1", "1 = municipio suprimido por n < 5"],
    ["edad_anios", "entero o vacío", "6-12", "Edad del niño o niña (vacío si k_generalizado >= 1)"],
    ["edad_tramo", "texto", "6-8, 9-10, 11-12", "Tramo de edad (siempre presente)"],
    ["sexo", "texto o vacío", "F, M, X", "Sexo declarado (vacío si k_generalizado = 2)"],
    [
      "informante",
      "texto o vacío",
      "madre, padre, cuidador, docente",
      "Quién responde (vacío si k_generalizado = 2)",
    ],
    [
      "k_generalizado",
      "entero",
      "0/1/2",
      "0 = sin cambios; 1 = edad a tramo; 2 = además sexo e informante en blanco",
    ],
    ["version_instrumento", "texto", listarInstrumentos().join(", "), "Instrumento aplicado"],
    [
      "version_consentimiento",
      "texto",
      "AAAA-MM-DD",
      "Versión (fecha) del consentimiento aceptado",
    ],
    ["duracion_segundos", "entero o vacío", ">= 0", "Tiempo de llenado"],
    [
      "par_id",
      "texto (16 hex) o vacío",
      "",
      "Seudónimo HMAC del código de vínculo (misma clave por descarga que `id`): la fila de la familia y la del docente del mismo niño comparten par_id dentro de un archivo; vacío si no hubo código. El código nunca se exporta",
    ],
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
  lineas.push(
    "Versión docente (`vanderbilt-docente-es-1.0`, informante = docente): departamento y municipio son los de la ESCUELA; la escala combinada de oposición/conducta (T19–T28) se guarda en `punt_conducta`/`pos_conducta` (≥ 3 de 10) y `pos_oposicion` es siempre 0 (sin ítems). Estas filas no entran en el mapa público. Emparejar con la familia por `par_id` (más reciente de cada informante si hay varias).",
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
