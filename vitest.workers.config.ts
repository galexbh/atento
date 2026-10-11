import path from "node:path";
import { cloudflareTest, readD1Migrations } from "@cloudflare/vitest-plugin";
import { defineConfig } from "vitest/config";

// Pruebas que corren DENTRO del runtime de Workers (workerd) con los bindings de wrangler.jsonc:
// tests/workers/**/*.test.ts. Las migraciones D1 se aplican en tests/workers/setup.ts.
export default defineConfig({
  plugins: [
    cloudflareTest(async () => {
      const migrations = await readD1Migrations(path.join(import.meta.dirname, "migrations"));
      return {
        wrangler: { configPath: "./wrangler.jsonc" },
        // `main` de wrangler.jsonc apunta a src/worker.ts, que depende de módulos virtuales de
        // Astro; aquí se usa una entrada mínima de prueba.
        main: "./tests/workers/entrada.ts",
        miniflare: {
          // Binding solo para pruebas: lista de migraciones que aplica setup.ts.
          bindings: { TEST_MIGRATIONS: migrations },
        },
      };
    }),
  ],
  test: {
    include: ["tests/workers/**/*.test.ts"],
    setupFiles: ["./tests/workers/setup.ts"],
    passWithNoTests: true,
  },
  resolve: {
    alias: { "@": new URL("./src", import.meta.url).pathname },
  },
});
