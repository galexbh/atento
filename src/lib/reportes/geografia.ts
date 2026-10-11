/** Reporte 2: geografía. n y % positivo por subescala y combinado, con IC95 Wilson. */
import { listarDepartamentos, obtenerMunicipio } from "../catalogo/geo";
import type { Escala } from "../puntuacion/tipos";
import { consultar, type Db, ESCALAS_SINTOMAS, SQL_COMBINADO, SQL_POSITIVO, where } from "./comun";
import type { Filtros } from "./filtros";
import { conteo, type Proporcion, proporcion } from "./supresion";

export interface FilaGeo {
  codigo: string;
  nombre: string;
  /** Código del departamento (para municipios). */
  departamento: string;
  n: number;
  suprimido: boolean;
  positivo: Proporcion;
  combinado: Proporcion;
  escalas: Record<(typeof ESCALAS_SINTOMAS)[number], Proporcion>;
}

export interface ReporteGeografia {
  departamentos: FilaGeo[];
  municipios: FilaGeo[];
  total: FilaGeo;
}

interface FilaSql {
  clave: string;
  n: number;
  positivo: number;
  combinado: number;
  inatencion: number;
  hiperactividad: number;
  oposicion: number;
  conducta: number;
  ansiedad_depresion: number;
}

const SUMAS = `COUNT(*) AS n,
  SUM(CASE WHEN ${SQL_POSITIVO} THEN 1 ELSE 0 END) AS positivo,
  SUM(CASE WHEN ${SQL_COMBINADO} THEN 1 ELSE 0 END) AS combinado,
  ${ESCALAS_SINTOMAS.map((e) => `SUM(COALESCE(pos_${e}, 0)) AS ${e}`).join(",\n  ")}`;

function aFila(f: FilaSql, nombre: string, departamento: string): FilaGeo {
  const celda = conteo(f.n);
  const escalas = {} as Record<(typeof ESCALAS_SINTOMAS)[number], Proporcion>;
  for (const e of ESCALAS_SINTOMAS) escalas[e] = proporcion(f[e], f.n);
  return {
    codigo: f.clave,
    nombre,
    departamento,
    n: celda.n,
    suprimido: celda.suprimido,
    positivo: proporcion(f.positivo, f.n),
    combinado: proporcion(f.combinado, f.n),
    escalas,
  };
}

export async function reporteGeografia(db: Db, filtros: Filtros): Promise<ReporteGeografia> {
  const w = where(filtros);
  const [porDepto, porMuni, total] = await Promise.all([
    consultar<FilaSql>(
      db,
      `SELECT departamento AS clave, ${SUMAS} FROM respuestas ${w.sql} GROUP BY departamento`,
      w.params,
    ),
    consultar<FilaSql>(
      db,
      `SELECT municipio AS clave, ${SUMAS} FROM respuestas ${w.sql} GROUP BY municipio`,
      w.params,
    ),
    consultar<FilaSql>(db, `SELECT 'total' AS clave, ${SUMAS} FROM respuestas ${w.sql}`, w.params),
  ]);
  const indiceDepto = new Map(porDepto.map((f) => [f.clave, f]));
  // Todos los departamentos aparecen, aun con n = 0, para que el mapa muestre "sin respuestas".
  const departamentos = listarDepartamentos().map((d) => {
    const f = indiceDepto.get(d.codigo) ?? {
      clave: d.codigo,
      n: 0,
      positivo: 0,
      combinado: 0,
      inatencion: 0,
      hiperactividad: 0,
      oposicion: 0,
      conducta: 0,
      ansiedad_depresion: 0,
    };
    return aFila(f, d.nombre, d.codigo);
  });
  const municipios = porMuni
    .map((f) => {
      const m = obtenerMunicipio(f.clave);
      return aFila(f, m?.nombre ?? f.clave, m?.departamento ?? f.clave.slice(0, 2));
    })
    .sort((a, b) => a.codigo.localeCompare(b.codigo));
  const t = total[0] as FilaSql;
  return { departamentos, municipios, total: aFila(t, "Total", "") };
}

export type EscalaGeo = Escala;
