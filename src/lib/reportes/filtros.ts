/**
 * Filtros comunes a todos los reportes del panel y su traducción a SQL parametrizado.
 *
 * Periodo: `2026` (año), `2026-Q1` (trimestre), `2026-03` (mes) o `acumulado` (todo).
 */

export const PERIODO_RE = /^(acumulado|\d{4}|\d{4}-Q[1-4]|\d{4}-(0[1-9]|1[0-2]))$/;

export const SEXOS = ["F", "M", "X"] as const;
export const INFORMANTES = ["madre", "padre", "cuidador", "docente"] as const;

export type Sexo = (typeof SEXOS)[number];
export type Informante = (typeof INFORMANTES)[number];

export interface Filtros {
  periodo: string;
  departamento?: string;
  municipio?: string;
  edadMin?: number;
  edadMax?: number;
  sexo?: Sexo;
  informante?: Informante;
  versionInstrumento?: string;
  soloConsentimiento: boolean;
  /** Segundo periodo para comparar (misma sintaxis que `periodo`). */
  comparar?: string;
}

export function periodoActual(): string {
  return String(new Date().getUTCFullYear());
}

/** Lee los filtros desde la query string; los valores inválidos o vacíos se ignoran. */
export function parsearFiltros(params: URLSearchParams): Filtros {
  const leer = (clave: string): string | undefined => {
    const v = params.get(clave);
    return v === null || v.trim() === "" ? undefined : v.trim();
  };
  const leerEdad = (clave: string): number | undefined => {
    const v = leer(clave);
    if (v === undefined || !/^\d{1,2}$/.test(v)) return undefined;
    const n = Number(v);
    return n >= 6 && n <= 12 ? n : undefined;
  };
  const periodo = leer("periodo");
  const comparar = leer("comparar");
  const departamento = leer("departamento");
  const municipio = leer("municipio");
  const sexo = leer("sexo");
  const informante = leer("informante");
  const version = leer("versionInstrumento");
  const filtros: Filtros = {
    periodo: periodo && PERIODO_RE.test(periodo) ? periodo : periodoActual(),
    soloConsentimiento: leer("soloConsentimiento") === "1",
  };
  if (comparar && PERIODO_RE.test(comparar)) filtros.comparar = comparar;
  if (departamento && /^\d{2}$/.test(departamento)) filtros.departamento = departamento;
  if (municipio && /^\d{4}$/.test(municipio)) filtros.municipio = municipio;
  const edadMin = leerEdad("edadMin");
  const edadMax = leerEdad("edadMax");
  if (edadMin !== undefined) filtros.edadMin = edadMin;
  if (edadMax !== undefined) filtros.edadMax = edadMax;
  if (sexo && (SEXOS as readonly string[]).includes(sexo)) filtros.sexo = sexo as Sexo;
  if (informante && (INFORMANTES as readonly string[]).includes(informante)) {
    filtros.informante = informante as Informante;
  }
  if (version && /^[\w.-]{1,64}$/.test(version)) filtros.versionInstrumento = version;
  return filtros;
}

/** Rango [desde, hasta) en fechas ISO para un periodo; null para `acumulado`. */
export function rangoPeriodo(periodo: string): { desde: string; hasta: string } | null {
  if (periodo === "acumulado") return null;
  const anio = Number(periodo.slice(0, 4));
  if (periodo.length === 4) return { desde: `${anio}-01-01`, hasta: `${anio + 1}-01-01` };
  if (periodo.includes("Q")) {
    const trimestre = Number(periodo.slice(6));
    const mesInicio = (trimestre - 1) * 3 + 1;
    return { desde: fechaIso(anio, mesInicio), hasta: fechaIso(anio, mesInicio + 3) };
  }
  const mes = Number(periodo.slice(5, 7));
  return { desde: fechaIso(anio, mes), hasta: fechaIso(anio, mes + 1) };
}

function fechaIso(anio: number, mes: number): string {
  const a = mes > 12 ? anio + 1 : anio;
  const m = mes > 12 ? mes - 12 : mes;
  return `${a}-${String(m).padStart(2, "0")}-01`;
}

export interface OpcionesWhere {
  /** Por defecto solo cuentan las respuestas completadas. */
  incluirIncompletas?: boolean;
  /** Ignora el filtro de periodo (reportes históricos). */
  ignorarPeriodo?: boolean;
  /** Usa otro periodo en lugar de `filtros.periodo` (comparaciones). */
  periodo?: string;
}

export interface Where {
  sql: string;
  params: (string | number)[];
}

/** Construye la cláusula WHERE (sin la palabra WHERE) con parámetros posicionales. */
export function construirWhere(filtros: Filtros, opciones: OpcionesWhere = {}): Where {
  const condiciones: string[] = [];
  const params: (string | number)[] = [];
  if (!opciones.incluirIncompletas) condiciones.push("completado = 1");
  if (!opciones.ignorarPeriodo) {
    const rango = rangoPeriodo(opciones.periodo ?? filtros.periodo);
    if (rango) {
      condiciones.push("creado_en >= ? AND creado_en < ?");
      params.push(rango.desde, rango.hasta);
    }
  }
  if (filtros.departamento) {
    condiciones.push("departamento = ?");
    params.push(filtros.departamento);
  }
  if (filtros.municipio) {
    condiciones.push("municipio = ?");
    params.push(filtros.municipio);
  }
  if (filtros.edadMin !== undefined) {
    condiciones.push("edad_anios >= ?");
    params.push(filtros.edadMin);
  }
  if (filtros.edadMax !== undefined) {
    condiciones.push("edad_anios <= ?");
    params.push(filtros.edadMax);
  }
  if (filtros.sexo) {
    condiciones.push("sexo = ?");
    params.push(filtros.sexo);
  }
  if (filtros.informante) {
    condiciones.push("informante = ?");
    params.push(filtros.informante);
  }
  if (filtros.versionInstrumento) {
    condiciones.push("version_instrumento = ?");
    params.push(filtros.versionInstrumento);
  }
  if (filtros.soloConsentimiento) condiciones.push("consentimiento_investigacion = 1");
  return { sql: condiciones.length ? condiciones.join(" AND ") : "1 = 1", params };
}

/** Serializa los filtros a query string (para enlaces del panel y auditoría). */
export function filtrosAQuery(filtros: Filtros, extra: Record<string, string> = {}): string {
  const p = new URLSearchParams();
  for (const [clave, valor] of Object.entries({ ...filtros, ...extra })) {
    if (valor === undefined || valor === false || valor === "") continue;
    p.set(clave, valor === true ? "1" : String(valor));
  }
  return p.toString();
}

/** Etiqueta legible del periodo. */
export function etiquetaPeriodo(periodo: string): string {
  if (periodo === "acumulado") return "Acumulado (todos los periodos)";
  if (periodo.includes("Q")) return `Trimestre ${periodo.slice(6)} de ${periodo.slice(0, 4)}`;
  if (periodo.length === 7) return `Mes ${periodo.slice(5)} de ${periodo.slice(0, 4)}`;
  return `Año ${periodo}`;
}
