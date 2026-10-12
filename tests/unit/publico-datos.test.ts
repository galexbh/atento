import { describe, expect, it } from "vitest";
import {
  type Celda,
  claseDiferencia,
  claseN,
  clasePct,
  construirPublicacion,
  type FilaConteo,
  type Publicacion,
  publicacionACsv,
  suprimirGrupo,
  UMBRAL_PUBLICO,
} from "@/lib/publico/datos";

const OPC = {
  preliminar: true,
  generadoEn: "2026-10-11T03:00:00.000Z",
  versionDataset: "preliminar",
};

/** Fila con n respuestas; `pos` positivas (inatención), `hip` de ellas también hiperactivas. */
function f(municipio: string, n: number, pos = 0, trimestre = 4, hip = 0): FilaConteo {
  return {
    departamento: municipio.slice(0, 2),
    municipio,
    trimestre,
    n,
    n_pos: pos,
    n_inat: pos,
    n_hiper: hip,
  };
}

function publicar(filas: FilaConteo[]): Publicacion {
  const p = construirPublicacion(filas, 2026, OPC);
  if (!p) throw new Error("se esperaba publicación");
  return p;
}

function todasLasCeldas(p: Publicacion): Celda[] {
  return [p.nacional, ...p.departamentos, ...p.municipios, ...p.serieTrimestral];
}

const muni = (p: Publicacion, c: string) => p.municipios.find((m) => m.codigo === c);
const depto = (p: Publicacion, c: string) => p.departamentos.find((d) => d.codigo === c);

describe("construirPublicacion: supresión primaria", () => {
  it("celdas con n < 5 se publican sin n ni porcentajes", () => {
    // 0801: 20, 0809: 3 y 0802: 4 (grupo suprimido 7 >= 5: no hace falta complementaria).
    const p = publicar([f("0801", 20, 4), f("0809", 3, 1), f("0802", 4, 2)]);
    expect(muni(p, "0809")).toMatchObject({
      n: null,
      suprimido: true,
      pctIndicadores: null,
      ic95: null,
      pctInatencion: null,
      pctHiperactividad: null,
    });
    expect(muni(p, "0802")?.suprimido).toBe(true);
    expect(muni(p, "0801")).toMatchObject({ n: 20, suprimido: false, pctIndicadores: 20 });
    expect(depto(p, "08")).toMatchObject({ n: 27, suprimido: false, nombre: "Francisco Morazán" });
    expect(p.nacional.n).toBe(27);
  });

  it("las celdas con n = 0 no aparecen", () => {
    const p = publicar([f("0801", 10, 1), f("0802", 0)]);
    expect(muni(p, "0802")).toBeUndefined();
    expect(p.departamentos.map((d) => d.codigo)).toEqual(["08"]);
  });
});

describe("construirPublicacion: supresión complementaria municipal", () => {
  it("un solo municipio suprimido arrastra al visible con menor n", () => {
    const p = publicar([f("0801", 30, 3), f("0802", 8, 1), f("0803", 12, 2), f("0809", 2, 1)]);
    expect(muni(p, "0809")?.suprimido).toBe(true);
    expect(muni(p, "0802")?.suprimido).toBe(true); // el menor visible (8)
    expect(muni(p, "0803")?.suprimido).toBe(false);
    expect(muni(p, "0801")?.suprimido).toBe(false);
  });

  it("grupo suprimido con total < 5 añade visibles hasta llegar a 5", () => {
    // 1 + 2 = 3 < 5 -> se añade 0803 (6); suma 9.
    const p = publicar([f("0801", 40), f("0802", 7), f("0803", 6), f("0808", 1), f("0809", 2)]);
    const suprimidos = p.municipios.filter((m) => m.suprimido).map((m) => m.codigo);
    expect(suprimidos).toEqual(["0803", "0808", "0809"]);
  });

  it("grupo suprimido con total >= 5 no necesita complementaria", () => {
    const p = publicar([f("0801", 40), f("0802", 7), f("0808", 3), f("0809", 4)]);
    const suprimidos = p.municipios.filter((m) => m.suprimido).map((m) => m.codigo);
    expect(suprimidos).toEqual(["0808", "0809"]);
  });

  it("si un departamento está suprimido, todos sus municipios también", () => {
    // Nacional: 08 = 50, 05 = 3 (primaria), 01 = 9 (complementaria) -> 01 suprimido aunque su
    // municipio 0101 tenga 9 respuestas.
    const p = publicar([f("0801", 50), f("0501", 3), f("0101", 9)]);
    expect(depto(p, "05")?.suprimido).toBe(true);
    expect(depto(p, "01")?.suprimido).toBe(true);
    expect(muni(p, "0101")?.suprimido).toBe(true);
    expect(depto(p, "08")?.suprimido).toBe(false);
  });
});

describe("construirPublicacion: nivel nacional y serie", () => {
  it("departamentos con complementaria respecto del total nacional", () => {
    const p = publicar([f("0801", 30), f("0501", 10), f("0301", 6), f("1801", 1)]);
    expect(depto(p, "18")?.suprimido).toBe(true);
    expect(depto(p, "03")?.suprimido).toBe(true); // menor visible
    expect(depto(p, "05")?.suprimido).toBe(false);
    expect(p.nacional).toMatchObject({ n: 47, suprimido: false });
  });

  it("serie trimestral con primaria y complementaria entre trimestres", () => {
    const p = publicar([
      f("0801", 20, 2, 1),
      f("0801", 3, 0, 2),
      f("0801", 9, 1, 3),
      f("0801", 30, 6, 4),
    ]);
    expect(p.serieTrimestral.map((t) => [t.codigo, t.suprimido])).toEqual([
      ["2026-Q1", false],
      ["2026-Q2", true],
      ["2026-Q3", true],
      ["2026-Q4", false],
    ]);
    expect(p.serieTrimestral[0]).toMatchObject({ trimestre: 1, n: 20, pctIndicadores: 10 });
  });

  it("total nacional < 5: no se publica nada", () => {
    expect(construirPublicacion([f("0801", 2), f("0501", 2)], 2026, OPC)).toBeNull();
    expect(construirPublicacion([], 2026, OPC)).toBeNull();
    expect(construirPublicacion([f("0801", 5)], 2026, OPC)).not.toBeNull();
  });
});

describe("construirPublicacion: redondeo y métricas", () => {
  it("porcentajes e IC95 de Wilson a 1 decimal; % con indicadores = inatención o hiperactividad", () => {
    // 3 de 7 con indicadores = 42,857... -> 42,9. 1 hiperactivo -> 14,3.
    const fila: FilaConteo = {
      departamento: "08",
      municipio: "0801",
      trimestre: 4,
      n: 7,
      n_pos: 3,
      n_inat: 2,
      n_hiper: 1,
    };
    const p = publicar([fila]);
    expect(p.nacional.pctIndicadores).toBe(42.9);
    expect(p.nacional.pctInatencion).toBe(28.6);
    expect(p.nacional.pctHiperactividad).toBe(14.3);
    expect(p.nacional.ic95).toEqual([15.8, 75]);
    for (const c of todasLasCeldas(p)) {
      for (const v of [c.pctIndicadores, c.pctInatencion, c.ic95?.[0], c.ic95?.[1]]) {
        if (v !== null && v !== undefined) expect(Math.round(v * 10) / 10).toBe(v);
      }
    }
    expect(p.clases.pct).toHaveLength(5);
    expect(p.anio).toBe(2026);
    expect(p.versionDataset).toBe("preliminar");
  });

  it("clases fijas", () => {
    expect([4.9, 5, 9.99, 10, 15, 19.9, 20, 80].map(clasePct)).toEqual([1, 2, 2, 3, 4, 4, 5, 5]);
    expect([5, 19, 20, 49, 50, 99, 100].map(claseN)).toEqual([1, 1, 2, 2, 3, 3, 4]);
    expect([-7, -5, -4.9, -1, -0.5, 1, 1.1, 4.9, 5].map(claseDiferencia)).toEqual([
      1, 1, 2, 3, 3, 3, 4, 4, 5,
    ]);
  });
});

describe("CSV", () => {
  it("UTF-8 con BOM, columnas fijas y n vacío si suprimido", () => {
    const p = publicar([f("0801", 20, 4), f("0809", 3, 1), f("0802", 4, 2)]);
    const csv = publicacionACsv(p);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    const lineas = csv.slice(1).trim().split("\r\n");
    expect(lineas[0]).toBe(
      "nivel,codigo,nombre,anio,n,pct_indicadores,ic95_inf,ic95_sup,pct_inatencion,pct_hiperactividad,suprimido,version_dataset,preliminar",
    );
    expect(lineas[1]).toMatch(/^nacional,HN,Honduras,2026,27,/);
    const suprimida = lineas.find((l) => l.startsWith("municipio,0809,"));
    expect(suprimida).toMatch(/^municipio,0809,[^,]+,2026,,,,,,,1,preliminar,1$/);
  });
});

// ---------------------------------------------------------------------------------------------
// Propiedad: ningún ataque por diferencia recupera una celda pequeña.

function generador(semilla: number) {
  let s = semilla >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

function aleatorias(azar: () => number): FilaConteo[] {
  const filas: FilaConteo[] = [];
  const deptos = 1 + Math.floor(azar() * 5);
  for (let d = 1; d <= deptos; d++) {
    const cod = String(d).padStart(2, "0");
    const munis = 1 + Math.floor(azar() * 5);
    for (let m = 1; m <= munis; m++) {
      const codM = `${cod}${String(m).padStart(2, "0")}`;
      for (let t = 1; t <= 4; t++) {
        if (azar() < 0.4) continue;
        // Mayoría de celdas pequeñas para estresar la supresión.
        const n = azar() < 0.7 ? Math.floor(azar() * 5) : Math.floor(azar() * 40);
        const pos = Math.floor(azar() * (n + 1));
        filas.push(f(codM, n, pos, t, Math.floor(azar() * (pos + 1))));
      }
    }
  }
  return filas;
}

/** Total real de un grupo menos lo que se publica de él: lo que un atacante puede deducir. */
function sumaSuprimida(
  real: Map<string, number>,
  publicado: { codigo: string; suprimido: boolean }[],
) {
  let s = 0;
  for (const c of publicado) if (c.suprimido) s += real.get(c.codigo) ?? 0;
  return s;
}

describe("propiedad: sin reconstrucción por diferencia", () => {
  it("para 2000 conjuntos aleatorios, total − suma de visibles nunca es 1–4", () => {
    const azar = generador(20261011);
    let publicados = 0;
    for (let i = 0; i < 2000; i++) {
      const filas = aleatorias(azar);
      const p = construirPublicacion(filas, 2026, OPC);
      const total = filas.reduce((a, x) => a + x.n, 0);
      if (total < UMBRAL_PUBLICO) {
        expect(p).toBeNull();
        continue;
      }
      if (!p) throw new Error("debía publicarse");
      publicados++;

      // Ninguna celda visible tiene n < 5.
      for (const c of todasLasCeldas(p)) {
        if (!c.suprimido) expect(c.n as number).toBeGreaterThanOrEqual(UMBRAL_PUBLICO);
        else expect(c.n).toBeNull();
      }

      const sumar = (clave: (x: FilaConteo) => string) => {
        const m = new Map<string, number>();
        for (const x of filas) m.set(clave(x), (m.get(clave(x)) ?? 0) + x.n);
        return m;
      };
      const nDepto = sumar((x) => x.departamento);
      const nMuni = sumar((x) => x.municipio);
      const nTrim = sumar((x) => `2026-Q${x.trimestre}`);

      // Nacional − departamentos visibles.
      const restoNacional = sumaSuprimida(nDepto, p.departamentos);
      expect(restoNacional === 0 || restoNacional >= UMBRAL_PUBLICO).toBe(true);
      expect(total - p.departamentos.reduce((a, d) => a + (d.n ?? 0), 0)).toBe(restoNacional);

      // Departamento visible − sus municipios visibles; departamento suprimido => municipios suprimidos.
      for (const d of p.departamentos) {
        const suyos = p.municipios.filter((m) => m.departamento === d.codigo);
        if (d.suprimido) {
          expect(suyos.every((m) => m.suprimido)).toBe(true);
          continue;
        }
        const resto = sumaSuprimida(nMuni, suyos);
        expect(resto === 0 || resto >= UMBRAL_PUBLICO, `${d.codigo}: resto ${resto}`).toBe(true);
      }

      // Total anual − trimestres visibles.
      const restoTrim = sumaSuprimida(nTrim, p.serieTrimestral);
      expect(restoTrim === 0 || restoTrim >= UMBRAL_PUBLICO).toBe(true);
    }
    expect(publicados).toBeGreaterThan(1000);
  });
});

describe("suprimirGrupo", () => {
  it("es determinista ante empates (elige el código menor)", () => {
    const s = suprimirGrupo(
      new Map([
        ["b", 9],
        ["a", 9],
        ["c", 2],
      ]),
    );
    expect([...s].sort()).toEqual(["a", "c"]);
  });
  it("sin visibles disponibles se detiene", () => {
    expect([...suprimirGrupo(new Map([["a", 2]]))]).toEqual(["a"]);
  });
});

describe("corte de la publicación preliminar", () => {
  it("último trimestre cerrado según la fecha", async () => {
    const { ultimoTrimestreCerrado } = await import("@/lib/publico/publicar");
    expect(ultimoTrimestreCerrado(2026, new Date("2026-02-10T00:00:00Z"))).toBe(0);
    expect(ultimoTrimestreCerrado(2026, new Date("2026-04-01T00:00:00Z"))).toBe(1);
    expect(ultimoTrimestreCerrado(2026, new Date("2026-10-12T00:00:00Z"))).toBe(3);
    expect(ultimoTrimestreCerrado(2025, new Date("2026-10-12T00:00:00Z"))).toBe(4);
    expect(ultimoTrimestreCerrado(2027, new Date("2026-10-12T00:00:00Z"))).toBe(0);
  });
});
