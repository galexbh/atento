/**
 * Límites de granularidad del rol investigador, comunes a la API y a las páginas del panel.
 * Combinar municipio con edad, sexo, informante o un periodo mensual permitiría aislar a muy
 * pocos niños; esas combinaciones quedan reservadas a la administración.
 */
import type { Filtros } from "@/lib/reportes/filtros";

export function validarFiltrosInvestigador(filtros: Filtros): string | null {
  if (!filtros.municipio) return null;
  const finos: string[] = [];
  if (filtros.edadMin !== undefined || filtros.edadMax !== undefined) finos.push("edad");
  if (filtros.sexo) finos.push("sexo");
  if (filtros.informante) finos.push("informante");
  if (/^\d{4}-(0[1-9]|1[0-2])$/.test(filtros.periodo)) finos.push("periodo mensual");
  if (finos.length === 0) return null;
  return `el rol investigador no puede combinar municipio con ${finos.join(", ")}`;
}
