/** Reporte 9: investigación. % con consentimiento y comparación de perfil con/sin consentimiento. */
import { consultar, type Db, SQL_POSITIVO, where } from "./comun";
import { redondear } from "./estadistica";
import type { Filtros } from "./filtros";
import { type Celda, conteo, type Proporcion, proporcion } from "./supresion";

export interface PerfilGrupo {
  grupo: "con_consentimiento" | "sin_consentimiento";
  n: Celda;
  edadMedia: number | null;
  sexo: Record<string, Proporcion>;
  nivel: Record<string, Proporcion>;
  positivo: Proporcion;
}

export interface ReporteInvestigacion {
  n: Celda;
  consentimiento: Proporcion;
  perfiles: PerfilGrupo[];
}

interface FilaSql {
  consentimiento: number;
  sexo: string | null;
  nivel: string | null;
  n: number;
  suma_edad: number;
  positivos: number;
}

export async function reporteInvestigacion(
  db: Db,
  filtros: Filtros,
): Promise<ReporteInvestigacion> {
  // Se ignora `soloConsentimiento` a propósito: este reporte compara ambos grupos.
  const w = where({ ...filtros, soloConsentimiento: false });
  const filas = await consultar<FilaSql>(
    db,
    `SELECT consentimiento_investigacion AS consentimiento, sexo, nivel, COUNT(*) AS n,
       SUM(edad_anios) AS suma_edad,
       SUM(CASE WHEN ${SQL_POSITIVO} THEN 1 ELSE 0 END) AS positivos
     FROM respuestas ${w.sql} GROUP BY consentimiento_investigacion, sexo, nivel`,
    w.params,
  );
  const total = filas.reduce((a, f) => a + f.n, 0);
  const conCons = filas.filter((f) => f.consentimiento === 1).reduce((a, f) => a + f.n, 0);
  const perfiles = ([1, 0] as const).map((valor): PerfilGrupo => {
    const grupo = filas.filter((f) => f.consentimiento === valor);
    const n = grupo.reduce((a, f) => a + f.n, 0);
    const sumaEdad = grupo.reduce((a, f) => a + f.suma_edad, 0);
    const positivos = grupo.reduce((a, f) => a + f.positivos, 0);
    const agrupar = (clave: "sexo" | "nivel", categorias: string[]) => {
      const salida: Record<string, Proporcion> = {};
      for (const c of categorias) {
        const k = grupo.filter((f) => (f[clave] ?? "sin dato") === c).reduce((a, f) => a + f.n, 0);
        salida[c] = proporcion(k, n);
      }
      return salida;
    };
    const celda = conteo(n);
    return {
      grupo: valor === 1 ? "con_consentimiento" : "sin_consentimiento",
      n: celda,
      edadMedia: celda.suprimido ? null : redondear(sumaEdad / n, 2),
      sexo: agrupar("sexo", ["F", "M", "X"]),
      nivel: agrupar("nivel", ["bajo", "moderado", "alto"]),
      positivo: proporcion(positivos, n),
    };
  });
  return { n: conteo(total), consentimiento: proporcion(conCons, total), perfiles };
}
