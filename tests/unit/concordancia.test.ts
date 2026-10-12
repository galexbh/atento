import { describe, expect, it } from "vitest";
import {
  calcularConcordancia,
  type FilaConcordancia,
  masRecientePorCodigo,
} from "../../src/lib/reportes/concordancia";
import { intervaloPearson, kappaCohen } from "../../src/lib/reportes/estadistica";

describe("kappaCohen", () => {
  it("ejemplo clásico 20/5/10/15 (n = 50): po 0,70, pe 0,50, κ = 0,40", () => {
    const k = kappaCohen(20, 5, 10, 15);
    expect(k).not.toBeNull();
    expect(k?.po).toBeCloseTo(0.7, 10);
    expect(k?.pe).toBeCloseTo(0.5, 10);
    expect(k?.kappa).toBeCloseTo(0.4, 10);
    // EE = √(0,7·0,3 / (50·0,25)) = 0,12961
    expect(k?.ee).toBeCloseTo(0.12961, 4);
    expect(k?.ic95.inferior).toBeCloseTo(0.146, 3);
    expect(k?.ic95.superior).toBeCloseTo(0.654, 3);
  });

  it("acuerdo perfecto con ambas categorías: κ = 1 (EE 0)", () => {
    const k = kappaCohen(10, 0, 0, 10);
    expect(k?.kappa).toBe(1);
    expect(k?.ic95).toEqual({ inferior: 1, superior: 1 });
  });

  it("acuerdo igual al azar: κ = 0; desacuerdo total: κ = -1", () => {
    expect(kappaCohen(25, 25, 25, 25)?.kappa).toBeCloseTo(0, 10);
    expect(kappaCohen(0, 10, 10, 0)?.kappa).toBeCloseTo(-1, 10);
  });

  it("sin datos o sin variabilidad (pe = 1) devuelve null", () => {
    expect(kappaCohen(0, 0, 0, 0)).toBeNull();
    expect(kappaCohen(0, 0, 0, 12)).toBeNull();
    expect(kappaCohen(12, 0, 0, 0)).toBeNull();
  });

  it("IC recortado a [-1, 1]", () => {
    const k = kappaCohen(3, 1, 1, 0);
    expect(k?.ic95.inferior).toBeGreaterThanOrEqual(-1);
    expect(k?.ic95.superior).toBeLessThanOrEqual(1);
  });
});

describe("intervaloPearson (z de Fisher)", () => {
  it("r = 0,5 con n = 28: IC ≈ [0,158; 0,736]", () => {
    const ic = intervaloPearson(0.5, 28);
    expect(ic?.inferior).toBeCloseTo(0.158, 2);
    expect(ic?.superior).toBeCloseTo(0.736, 2);
  });
  it("no definido con n ≤ 3 o |r| = 1", () => {
    expect(intervaloPearson(0.5, 3)).toBeNull();
    expect(intervaloPearson(1, 30)).toBeNull();
  });
});

function fila(codigo: string, parcial: Partial<FilaConcordancia> = {}): FilaConcordancia {
  return {
    codigo,
    id: `${codigo}-${Math.random().toString(36).slice(2)}`,
    creado_en: "2026-05-01",
    pos_inatencion: 0,
    pos_hiperactividad: 0,
    pos_oposicion: 0,
    pos_conducta: 0,
    pos_ansiedad_depresion: 0,
    pos_desempeno: 0,
    punt_inatencion: 5,
    punt_hiperactividad: 5,
    ...parcial,
  };
}

describe("concordancia padre–docente (cálculo puro)", () => {
  it("la más reciente de cada informante (empate de fecha: id mayor)", () => {
    const { porCodigo, repetidos } = masRecientePorCodigo([
      fila("AAAA1111", { id: "a", creado_en: "2026-01-01" }),
      fila("AAAA1111", { id: "b", creado_en: "2026-03-01" }),
      fila("AAAA1111", { id: "c", creado_en: "2026-02-01" }),
      fila("BBBB2222", { id: "x", creado_en: "2026-04-01" }),
      fila("BBBB2222", { id: "y", creado_en: "2026-04-01" }),
    ]);
    expect(porCodigo.get("AAAA1111")?.id).toBe("b");
    expect(porCodigo.get("BBBB2222")?.id).toBe("y");
    expect([...repetidos].sort()).toEqual(["AAAA1111", "BBBB2222"]);
  });

  it("menos de 5 pares: todo suprimido", () => {
    const familias = ["C1", "C2", "C3", "C4"].map((c) => fila(c, { pos_inatencion: 1 }));
    const docentes = ["C1", "C2", "C3", "C4", "C9"].map((c) => fila(c, { pos_inatencion: 1 }));
    const r = calcularConcordancia({ familias, docentes, docentesSinCodigo: 7 });
    expect(r.pares).toEqual({ n: 0, suprimido: true });
    expect(r.dosEntornos.suprimido).toBe(true);
    for (const a of r.acuerdo) {
      expect(a.kappa).toBeNull();
      expect(a.acuerdo.pct).toBeNull();
      expect(a.tabla.ambos.suprimido).toBe(true);
    }
    for (const c of r.correlacion) expect(c.r).toBeNull();
    expect(r.docentesSinCodigo).toEqual({ n: 7, suprimido: false });
  });

  it("calcula tabla 2×2, acuerdo, kappa, Pearson y positivos en ambos entornos", () => {
    // 50 pares de inatención con la tabla 20/5/10/15 (κ = 0,4).
    const familias: FilaConcordancia[] = [];
    const docentes: FilaConcordancia[] = [];
    const celdas: Array<[number, 0 | 1, 0 | 1]> = [
      [20, 1, 1],
      [5, 1, 0],
      [10, 0, 1],
      [15, 0, 0],
    ];
    let i = 0;
    for (const [k, f, d] of celdas) {
      for (let j = 0; j < k; j++, i++) {
        const codigo = `P${String(i).padStart(7, "0")}`;
        familias.push(
          fila(codigo, {
            pos_inatencion: f,
            pos_oposicion: f,
            punt_inatencion: 10 + (i % 7),
            punt_hiperactividad: i % 5,
          }),
        );
        docentes.push(
          fila(codigo, {
            pos_inatencion: d,
            pos_conducta: f,
            punt_inatencion: 8 + (i % 7),
            punt_hiperactividad: 20 - (i % 5),
          }),
        );
      }
    }
    // Una familia con código sin docente y un docente con código sin familia: no forman par.
    familias.push(fila("SOLOFAM1"));
    docentes.push(fila("SOLODOC1"));
    const r = calcularConcordancia({ familias, docentes, docentesSinCodigo: 2 });
    expect(r.pares).toEqual({ n: 50, suprimido: false });
    expect(r.familiasConCodigo.n).toBe(51);
    expect(r.docentesConCodigo.n).toBe(51);
    expect(r.docentesSinCodigo).toEqual({ n: 0, suprimido: true });
    const inat = r.acuerdo.find((a) => a.escala === "inatencion");
    expect(inat?.tabla).toEqual({
      ambos: { n: 20, suprimido: false },
      soloFamilia: { n: 5, suprimido: false },
      soloDocente: { n: 10, suprimido: false },
      ninguno: { n: 15, suprimido: false },
    });
    expect(inat?.acuerdo.pct).toBe(70);
    expect(inat?.kappa?.valor).toBeCloseTo(0.4, 3);
    // "Con indicadores" = inatención o hiperactividad (hiperactividad siempre 0 aquí).
    expect(r.acuerdo.find((a) => a.escala === "sintomas")?.kappa?.valor).toBeCloseTo(0.4, 3);
    // Oposición o conducta de la familia frente a la escala combinada del docente: acuerdo total.
    const oc = r.acuerdo.find((a) => a.escala === "oposicion_conducta");
    expect(oc?.acuerdo.pct).toBe(100);
    expect(oc?.kappa?.valor).toBe(1);
    // Sin variabilidad (todo negativo) no hay kappa, pero sí % de acuerdo.
    const ans = r.acuerdo.find((a) => a.escala === "ansiedad_depresion");
    expect(ans?.kappa).toBeNull();
    expect(ans?.acuerdo.pct).toBe(100);
    // Pearson: inatención con desfase constante → r = 1; hiperactividad invertida → r = -1.
    const corr = new Map(r.correlacion.map((c) => [c.escala, c]));
    expect(corr.get("inatencion")?.r).toBe(1);
    expect(corr.get("hiperactividad")?.r).toBe(-1);
    expect(corr.get("inatencion")?.n).toEqual({ n: 50, suprimido: false });
    expect(corr.get("total_1_18")?.r).not.toBeNull();
    // Positivo en ambos entornos: 20 de 50.
    expect(r.dosEntornos.pct).toBe(40);
    expect(r.dosEntornos.ic95).not.toBeNull();
  });

  it("las celdas 2×2 con n < 5 se suprimen aunque haya ≥ 5 pares", () => {
    const familias = ["A", "B", "C", "D", "E", "F"].map((c, i) =>
      fila(`X000000${c}`, { pos_desempeno: i === 0 ? 1 : 0 }),
    );
    const docentes = familias.map((f) => fila(f.codigo, { pos_desempeno: 0 }));
    const r = calcularConcordancia({ familias, docentes, docentesSinCodigo: 0 });
    const des = r.acuerdo.find((a) => a.escala === "desempeno");
    expect(des?.n).toEqual({ n: 6, suprimido: false });
    expect(des?.tabla.soloFamilia).toEqual({ n: 0, suprimido: true });
    expect(des?.tabla.ninguno).toEqual({ n: 5, suprimido: false });
  });
});
