import { afterEach, describe, expect, it, vi } from "vitest";
import { hostsPermitidos, tokenConFormaValida, verificarTurnstile } from "@/lib/api/turnstile";
import { ACCION_ENVIO, LONGITUD_MAXIMA_TOKEN } from "@/lib/compartido/turnstile";

const SECRETO_FICTICIO = "0x4AAAAAAAsecretoFicticioParaTests00";

function simular(respuesta: Record<string, unknown>, status = 200) {
  const espia = vi.fn(async () => Response.json(respuesta, { status }));
  vi.stubGlobal("fetch", espia);
  return espia;
}

const base = {
  secreto: SECRETO_FICTICIO,
  entorno: "produccion",
  token: "token-real",
  sitio: "https://atento.galexbh.dev",
};

describe("verificarTurnstile", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("acepta success + acción + host del despliegue", async () => {
    simular({ success: true, action: ACCION_ENVIO, hostname: "atento.galexbh.dev" });
    expect(await verificarTurnstile(base)).toBe(true);
  });

  it("rechaza acción distinta", async () => {
    simular({ success: true, action: "login", hostname: "atento.galexbh.dev" });
    expect(await verificarTurnstile(base)).toBe(false);
  });

  it("rechaza host ausente, ajeno o localhost fuera de local", async () => {
    for (const hostname of [undefined, "malo.example", "localhost", "127.0.0.1"]) {
      simular({ success: true, action: ACCION_ENVIO, hostname });
      expect(await verificarTurnstile(base)).toBe(false);
    }
  });

  it("preview solo acepta su propio host", async () => {
    const preview = { ...base, entorno: "preview", sitio: "https://atento-preview.galexbh.dev" };
    simular({ success: true, action: ACCION_ENVIO, hostname: "atento-preview.galexbh.dev" });
    expect(await verificarTurnstile(preview)).toBe(true);
    simular({ success: true, action: ACCION_ENVIO, hostname: "atento.galexbh.dev" });
    expect(await verificarTurnstile(preview)).toBe(false);
  });

  it("falla cerrado ante success=false, HTTP no OK o error de red", async () => {
    simular({ success: false, "error-codes": ["timeout-or-duplicate"] });
    expect(await verificarTurnstile(base)).toBe(false);
    simular({ success: true }, 500);
    expect(await verificarTurnstile(base)).toBe(false);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Promise.reject(new Error("red"))),
    );
    expect(await verificarTurnstile(base)).toBe(false);
  });

  it("no llama a siteverify con tokens vacíos o demasiado largos", async () => {
    const espia = simular({ success: true, action: ACCION_ENVIO, hostname: "atento.galexbh.dev" });
    expect(await verificarTurnstile({ ...base, token: "" })).toBe(false);
    expect(
      await verificarTurnstile({ ...base, token: "x".repeat(LONGITUD_MAXIMA_TOKEN + 1) }),
    ).toBe(false);
    expect(espia).not.toHaveBeenCalled();
  });
});

describe("hostsPermitidos y tokenConFormaValida", () => {
  it("localhost solo en desarrollo", () => {
    expect(hostsPermitidos("https://atento.galexbh.dev", "produccion")).toEqual([
      "atento.galexbh.dev",
    ]);
    expect(hostsPermitidos("http://localhost:4321", "local")).toEqual([
      "localhost",
      "localhost",
      "127.0.0.1",
    ]);
  });

  it("límite de 2048 caracteres", () => {
    expect(tokenConFormaValida("a".repeat(LONGITUD_MAXIMA_TOKEN))).toBe(true);
    expect(tokenConFormaValida("a".repeat(LONGITUD_MAXIMA_TOKEN + 1))).toBe(false);
  });
});
