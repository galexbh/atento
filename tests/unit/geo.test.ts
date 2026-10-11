import { describe, expect, it } from "vitest";
import {
  esMunicipioValido,
  listarDepartamentos,
  listarMunicipios,
  listarTodosLosMunicipios,
  obtenerMunicipio,
} from "../../src/lib/catalogo/geo";

describe("catálogo geográfico de Honduras", () => {
  const departamentos = listarDepartamentos();
  const municipios = listarTodosLosMunicipios();

  it("tiene 18 departamentos con códigos 01–18 consecutivos", () => {
    expect(departamentos).toHaveLength(18);
    departamentos.forEach((d, idx) => {
      expect(d.codigo).toBe(String(idx + 1).padStart(2, "0"));
    });
  });

  it("tiene 298 municipios con códigos únicos de 4 dígitos", () => {
    expect(municipios).toHaveLength(298);
    const codigos = municipios.map((m) => m.codigo);
    expect(new Set(codigos).size).toBe(298);
    for (const c of codigos) expect(c).toMatch(/^\d{4}$/);
  });

  it("cada municipio lleva el prefijo de su departamento y el departamento existe", () => {
    const codDeptos = new Set(departamentos.map((d) => d.codigo));
    for (const m of municipios) {
      expect(m.codigo.slice(0, 2)).toBe(m.departamento);
      expect(codDeptos.has(m.departamento)).toBe(true);
    }
  });

  it("no hay nombres vacíos ni nombres duplicados dentro de un departamento", () => {
    for (const d of departamentos) expect(d.nombre.trim().length).toBeGreaterThan(0);
    for (const d of departamentos) {
      const nombres = listarMunicipios(d.codigo).map((m) => m.nombre.trim());
      expect(nombres.every((n) => n.length > 0)).toBe(true);
      expect(new Set(nombres).size).toBe(nombres.length);
    }
  });

  it("cada departamento tiene al menos un municipio y la cabecera es xx01", () => {
    for (const d of departamentos) {
      const ms = listarMunicipios(d.codigo);
      expect(ms.length).toBeGreaterThan(0);
      expect(ms[0]?.codigo).toBe(`${d.codigo}01`);
    }
  });

  it("muestras conocidas: Distrito Central 0801, La Ceiba 0101, Esparta 0103, Arizona 0108", () => {
    expect(obtenerMunicipio("0801")?.nombre).toBe("Distrito Central");
    expect(obtenerMunicipio("0101")?.nombre).toBe("La Ceiba");
    expect(obtenerMunicipio("0103")?.nombre).toBe("Esparta");
    expect(obtenerMunicipio("0108")?.nombre).toBe("Arizona");
    expect(obtenerMunicipio("0501")?.nombre).toBe("San Pedro Sula");
    expect(obtenerMunicipio("9999")).toBeUndefined();
  });

  it("esMunicipioValido exige pertenencia al departamento", () => {
    expect(esMunicipioValido("0801", "08")).toBe(true);
    expect(esMunicipioValido("0801", "01")).toBe(false);
    expect(esMunicipioValido("0899", "08")).toBe(false);
  });
});
