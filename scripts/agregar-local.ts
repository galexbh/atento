/**
 * Recalcula `agregados_municipio` en la D1 local sin levantar el servidor.
 *
 *   pnpm agregar:local [--snapshot 2025]
 *
 * Misma lógica pura que el cron (`agregar()` de src/lib/agregados/calcular.ts), pero leyendo y
 * escribiendo con `wrangler d1 execute --local`. Al final borra las claves `agregado:*` de la KV
 * local (mejor esfuerzo). Alternativa equivalente con el cron real:
 *   pnpm build && pnpm exec wrangler dev --test-scheduled
 *   curl "http://127.0.0.1:8787/__scheduled?cron=0+3+*+*+*"
 */
import { execSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { agregar, type FilaRespuesta, VERSION_TODAS } from "../src/lib/agregados/calcular";
import {
  COLUMNAS_AGREGADO,
  literalSql,
  parametrosAgregado,
  SELECT_FILAS_PARA_AGREGAR,
  trocear,
} from "../src/lib/agregados/sql";

const args = process.argv.slice(2);
const iSnapshot = args.indexOf("--snapshot");
const SNAPSHOT = iSnapshot >= 0 ? (args[iSnapshot + 1] ?? null) : null;
const DIR = ".wrangler";
mkdirSync(DIR, { recursive: true });

function d1(archivo: string, json = false): string {
  return execSync(
    `pnpm exec wrangler d1 execute atento-db --local --file ${archivo}${json ? " --json" : ""}`,
    { encoding: "utf-8", stdio: ["ignore", "pipe", "inherit"], maxBuffer: 256 * 1024 * 1024 },
  );
}

// 1. Leer respuestas completadas.
const archivoSelect = `${DIR}/agregados-select.sql`;
writeFileSync(archivoSelect, `${SELECT_FILAS_PARA_AGREGAR};\n`);
const salida = d1(archivoSelect, true);
const inicioJson = salida.indexOf("[");
const resultado = JSON.parse(salida.slice(inicioJson)) as { results: FilaRespuesta[] }[];
const filas = resultado[0]?.results ?? [];

// 2. Agregar en memoria.
const calculadoEn = new Date().toISOString();
const agregados = agregar(filas);

// 3. Escribir SQL: reemplazar todo y borrar lo obsoleto.
const columnas = COLUMNAS_AGREGADO.join(", ");
const sentencias = trocear(agregados, 50).map(
  (grupo) =>
    `INSERT OR REPLACE INTO agregados_municipio (${columnas}) VALUES\n${grupo
      .map((f) => `(${parametrosAgregado(f, calculadoEn).map(literalSql).join(", ")})`)
      .join(",\n")};`,
);
sentencias.push(
  `DELETE FROM agregados_municipio WHERE calculado_en <> ${literalSql(calculadoEn)};`,
);
if (SNAPSHOT) {
  sentencias.push(
    `INSERT OR IGNORE INTO agregados_anuales (periodo, departamento, municipio, n, pct_inatencion, pct_hiperactividad, pct_combinado, pct_ambas, ic95_inf, ic95_sup, suprimido, version_instrumento, version_dataset, calculado_en)
SELECT periodo, departamento, municipio, n, pct_inatencion, pct_hiperactividad, pct_combinado, pct_ambas, ic95_inf, ic95_sup, suprimido, version_instrumento, 'v1', ${literalSql(calculadoEn)}
FROM agregados_municipio WHERE periodo = ${literalSql(SNAPSHOT)} AND version_instrumento = ${literalSql(VERSION_TODAS)};`,
  );
}
const archivoAgregados = `${DIR}/agregados.sql`;
writeFileSync(archivoAgregados, `-- Agregados locales ${calculadoEn}\n${sentencias.join("\n")}\n`);
d1(archivoAgregados);

const periodos = new Set(agregados.map((a) => a.periodo));
const suprimidos = agregados.filter((a) => a.suprimido === 1).length;
console.log(
  `Leídas ${filas.length} respuestas; escritas ${agregados.length} filas de agregados (${suprimidos} suprimidas por n < 5) en ${periodos.size} periodos.`,
);

// 4. Invalidar la caché KV local (mejor esfuerzo: puede no existir aún).
try {
  const lista = execSync(
    "pnpm exec wrangler kv key list --binding CACHE --local --prefix agregado:",
    {
      encoding: "utf-8",
      stdio: ["ignore", "pipe", "ignore"],
    },
  );
  const claves = JSON.parse(lista.slice(lista.indexOf("["))) as { name: string }[];
  for (const k of claves) {
    execSync(`pnpm exec wrangler kv key delete --binding CACHE --local "${k.name}"`, {
      stdio: "ignore",
    });
  }
  if (claves.length > 0) console.log(`Caché KV local invalidada (${claves.length} claves).`);
} catch {
  console.log("No se pudo listar la KV local (sin caché que invalidar).");
}
