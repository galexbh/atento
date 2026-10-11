/**
 * Genera scripts/seed-admin.sql con ~300 respuestas sintéticas para probar el panel /admin.
 *
 *   pnpm tsx scripts/seed-admin.ts
 *   pnpm exec wrangler d1 execute atento-db --local --file scripts/seed-admin.sql
 */
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { filasASql, generarFilas } from "../src/lib/admin/sintetico";

const filas = generarFilas({ n: 300, semilla: 2026, anios: { 2026: 5, 2025: 1 } });
const destino = resolve(import.meta.dirname, "seed-admin.sql");
writeFileSync(
  destino,
  `-- Datos sintéticos (sin personas reales) para el panel /admin. Generado por scripts/seed-admin.ts.\n${filasASql(filas)}`,
);
console.log(`${filas.length} filas escritas en ${destino}`);
