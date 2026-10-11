import { applyD1Migrations, type D1Migration } from "cloudflare:test";
import { env } from "cloudflare:workers";

// TEST_MIGRATIONS es un binding solo de pruebas (ver vitest.workers.config.ts), por eso no forma
// parte de Cloudflare.Env.
const { TEST_MIGRATIONS } = env as unknown as { TEST_MIGRATIONS: D1Migration[] };

// Aplica solo las migraciones pendientes; es seguro ejecutarlo varias veces.
await applyD1Migrations(env.DB, TEST_MIGRATIONS);
