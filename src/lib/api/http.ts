/** Utilidades HTTP compartidas por los endpoints de /api. */

export function json(cuerpo: unknown, status = 200, cabeceras: Record<string, string> = {}) {
  return new Response(JSON.stringify(cuerpo), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      ...cabeceras,
    },
  });
}

export function error(status: number, motivo: string, extra: Record<string, unknown> = {}) {
  return json({ ok: false, motivo, ...extra }, status);
}

/** Convierte issues de zod en una lista {campo, mensaje} sin eco del valor recibido. */
export function formatearErrores(
  issues: readonly { code: string; path: readonly PropertyKey[]; message: string }[],
): { campo: string; mensaje: string }[] {
  return issues.map((i) => {
    const claves = i.code === "unrecognized_keys" ? (i as { keys?: string[] }).keys : undefined;
    const campo = claves?.length ? claves.join(",") : i.path.map(String).join(".") || "(raiz)";
    return { campo, mensaje: i.message };
  });
}

/** Log estructurado sin datos sensibles (solo evento, estado y duración). */
export function registrar(
  evento: string,
  status: number,
  inicio: number,
  extra: Record<string, unknown> = {},
) {
  console.log(JSON.stringify({ evento, status, ms: Date.now() - inicio, ...extra }));
}

/** IP del cliente tal como la ve Cloudflare (nunca se guarda; solo se usa para hashear). */
export function ipDelCliente(request: Request): string {
  return (
    request.headers.get("CF-Connecting-IP") ??
    request.headers.get("X-Forwarded-For")?.split(",")[0]?.trim() ??
    "sin-ip"
  );
}

/** Fecha UTC YYYY-MM-DD. */
export function fechaUtc(ahora: Date = new Date()): string {
  return ahora.toISOString().slice(0, 10);
}

export async function sha256Hex(texto: string): Promise<string> {
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(texto));
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
