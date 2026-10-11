import path from "node:path";
import { cloudflareTest, readD1Migrations } from "@cloudflare/vitest-plugin";
import { defineConfig } from "vitest/config";
import { generarHash } from "./src/lib/admin/password";
import { CONTRASENA_PRUEBA } from "./tests/workers/admin-constantes";

// Pruebas del panel /admin dentro de workerd, con D1 real migrada y modo password activado.
export default defineConfig({
  plugins: [
    cloudflareTest(async () => {
      const migrations = await readD1Migrations(path.join(import.meta.dirname, "migrations"));
      const hash = await generarHash(CONTRASENA_PRUEBA);
      return {
        wrangler: { configPath: "./wrangler.jsonc" },
        main: "./tests/workers/entrada-admin.ts",
        miniflare: {
          bindings: {
            TEST_MIGRATIONS: migrations,
            ENTORNO: "local",
            ADMIN_MODO: "password",
            ADMIN_PASSWORD_HASH: hash,
            ADMIN_SESSION_SECRET: "secreto-de-sesion-solo-para-pruebas",
            ADMIN_EMAILS: "admin@ejemplo.org",
            INVESTIGADOR_EMAILS: "investigador@ejemplo.org",
            ACCESS_TEAM_DOMAIN: "pruebas.cloudflareaccess.com",
            ACCESS_AUD: "aud-de-prueba",
          },
        },
      };
    }),
  ],
  test: {
    include: ["tests/workers/admin*.test.ts"],
    setupFiles: ["./tests/workers/setup.ts"],
    passWithNoTests: true,
  },
  resolve: {
    alias: { "@": new URL("./src", import.meta.url).pathname },
  },
});
