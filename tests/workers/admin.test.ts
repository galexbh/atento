import { env, exports } from "cloudflare:workers";
import { beforeEach, describe, expect, it } from "vitest";
import {
  base64UrlCodificar,
  limpiarCacheJwks,
  rolDeCorreo,
  verificarJwtAccess,
} from "@/lib/admin/acceso";
import {
  crearSesion,
  hashIp,
  NOMBRE_COOKIE,
  verificarContrasena,
  verificarSesion,
} from "@/lib/admin/password";
import { generarFilas, SQL_INSERT, valoresInsert } from "@/lib/admin/sintetico";
import { construirFila, parametrosRespuesta, SQL_INSERTAR_RESPUESTA } from "@/lib/db/respuestas";
import { obtenerInstrumento } from "@/lib/puntuacion/instrumentos";
import type { Envio } from "@/lib/validacion/respuesta";
import { CONTRASENA_INVESTIGADOR_PRUEBA, CONTRASENA_PRUEBA } from "./admin-constantes";

const BASE = "https://atento.galexbh.dev";

// El almacenamiento de D1 se comparte entre pruebas del archivo: se limpia antes de cada una.
beforeEach(async () => {
  await env.DB.batch([
    env.DB.prepare("DELETE FROM respuestas"),
    env.DB.prepare("DELETE FROM auditoria_admin"),
    env.DB.prepare("DELETE FROM configuracion WHERE clave = 'sesiones_no_antes_de'"),
  ]);
});
const worker = exports.default;

async function sembrar(n: number, semilla = 7) {
  const filas = generarFilas({ n, semilla, anios: { 2026: 5, 2025: 1 } });
  const sentencias = filas.map((f) => env.DB.prepare(SQL_INSERT).bind(...valoresInsert(f)));
  for (let i = 0; i < sentencias.length; i += 50) {
    await env.DB.batch(sentencias.slice(i, i + 50));
  }
  return filas;
}

async function entrar(contrasena = CONTRASENA_PRUEBA, ip = "203.0.113.5"): Promise<Response> {
  const cuerpo = new URLSearchParams({ contrasena, volver: "/admin/geografia" });
  return worker.fetch(
    new Request(`${BASE}/api/admin/entrar`, {
      method: "POST",
      redirect: "manual",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "CF-Connecting-IP": ip,
      },
      body: cuerpo,
    }),
  );
}

async function cookieAdmin(): Promise<string> {
  const r = await entrar();
  const setCookie = r.headers.get("Set-Cookie") ?? "";
  const valor = setCookie.split(";")[0] ?? "";
  expect(valor.startsWith(`${NOMBRE_COOKIE}=`)).toBe(true);
  return valor;
}

async function cookieInvestigador(): Promise<string> {
  const secreto = env.ADMIN_SESSION_SECRET as string;
  const valor = await crearSesion(secreto, "investigador@ejemplo.org", "investigador");
  return `${NOMBRE_COOKIE}=${valor}`;
}

function get(ruta: string, cookie?: string): Promise<Response> {
  return worker.fetch(new Request(`${BASE}${ruta}`, { headers: cookie ? { Cookie: cookie } : {} }));
}

describe("autenticación del panel (modo password)", () => {
  it("sin sesión responde 401 en la API", async () => {
    expect((await get("/api/admin/reporte/resumen")).status).toBe(401);
    expect((await get("/api/admin/exportar?tipo=agregados")).status).toBe(401);
  });

  it("la contraseña correcta emite cookie de sesión y permite leer reportes", async () => {
    const r = await entrar();
    expect(r.status).toBe(303);
    expect(r.headers.get("Location")).toBe("/admin/geografia");
    const setCookie = r.headers.get("Set-Cookie") ?? "";
    expect(setCookie).toContain("HttpOnly");
    expect(setCookie).toContain("SameSite=Strict");
    // M4: Path=/ para que /api/admin/* reciba la cookie (antes Path=/admin la excluía).
    expect(setCookie).toMatch(/;\s*Path=\/(;|$)/);
    expect(setCookie).not.toContain("Path=/admin");
    const cookie = setCookie.split(";")[0] as string;
    const reporte = await get("/api/admin/reporte/resumen?periodo=2026", cookie);
    expect(reporte.status).toBe(200);
    const cuerpo = await reporte.json<{ meta: { reporte: string }; datos: unknown }>();
    expect(cuerpo.meta.reporte).toBe("resumen");
    const codebook = await get("/api/admin/exportar?tipo=codebook", cookie);
    expect(codebook.status).toBe(200);
  });

  it("la contraseña de investigación da sesión de solo lectura", async () => {
    const r = await entrar(CONTRASENA_INVESTIGADOR_PRUEBA, "203.0.113.41");
    expect(r.status).toBe(303);
    const cookie = (r.headers.get("Set-Cookie") ?? "").split(";")[0] as string;
    const sesion = await verificarSesion(
      env.ADMIN_SESSION_SECRET as string,
      cookie.slice(NOMBRE_COOKIE.length + 1),
    );
    expect(sesion?.r).toBe("investigador");
    expect(sesion?.u).toBe("Investigación");
    expect((await get("/api/admin/reporte/resumen?periodo=2026", cookie)).status).toBe(200);
    expect((await get("/api/admin/exportar?tipo=agregados", cookie)).status).toBe(200);
    expect((await get("/api/admin/exportar?tipo=microdatos", cookie)).status).toBe(403);
    expect(
      (await get("/api/admin/reporte/resumen?periodo=2026&municipio=0801&sexo=F", cookie)).status,
    ).toBe(403);
  });

  it("la sesión de administración se identifica como Administración", async () => {
    const r = await entrar(CONTRASENA_PRUEBA, "203.0.113.42");
    const cookie = (r.headers.get("Set-Cookie") ?? "").split(";")[0] as string;
    const sesion = await verificarSesion(
      env.ADMIN_SESSION_SECRET as string,
      cookie.slice(NOMBRE_COOKIE.length + 1),
    );
    expect(sesion).toMatchObject({ r: "admin", u: "Administración" });
  });

  it("M6: la sesión lleva iat y 'cerrar todas las sesiones' invalida las anteriores", async () => {
    const cookie = await cookieAdmin();
    const sesion = await verificarSesion(
      env.ADMIN_SESSION_SECRET as string,
      cookie.slice(NOMBRE_COOKIE.length + 1),
    );
    expect(typeof sesion?.iat).toBe("number");
    expect((await get("/api/admin/reporte/resumen", cookie)).status).toBe(200);
    // Las sesiones se emiten con resolución de segundos: espera para que el corte sea posterior.
    await new Promise((r) => setTimeout(r, 1100));
    const cerrar = await worker.fetch(
      new Request(`${BASE}/api/admin/sistema`, {
        method: "POST",
        headers: { Cookie: cookie, Accept: "application/json" },
        body: new URLSearchParams({ accion: "cerrar_sesiones" }),
      }),
    );
    expect(cerrar.status).toBe(200);
    expect((await get("/api/admin/reporte/resumen", cookie)).status).toBe(401);
    const fila = await env.DB.prepare(
      "SELECT valor FROM configuracion WHERE clave = 'sesiones_no_antes_de'",
    ).first<{ valor: string }>();
    expect(Number(fila?.valor)).toBeGreaterThan(0);
    const auditoria = await env.DB.prepare(
      "SELECT accion FROM auditoria_admin WHERE accion = 'cerrar_sesiones'",
    ).all();
    expect(auditoria.results).toHaveLength(1);
    // Una sesión nueva vuelve a funcionar.
    await new Promise((r) => setTimeout(r, 1100));
    const nueva = await cookieAdmin();
    expect((await get("/api/admin/reporte/resumen", nueva)).status).toBe(200);
  });

  it("M3: el hash de IP de los intentos usa HMAC con sal (distinto por sal)", async () => {
    const a = await hashIp("203.0.113.5", "sal-1");
    const b = await hashIp("203.0.113.5", "sal-2");
    expect(a).not.toBe(b);
    expect(a).toHaveLength(32);
    expect(await hashIp("203.0.113.5", "sal-1")).toBe(a);
  });

  it("contraseña incorrecta redirige con error y bloquea tras 5 intentos", async () => {
    const ip = "198.51.100.9";
    for (let i = 1; i <= 4; i++) {
      const r = await entrar("mala", ip);
      expect(r.headers.get("Location")).toBe("/admin/entrar?error=credenciales");
    }
    const quinta = await entrar("mala", ip);
    expect(quinta.headers.get("Location")).toBe("/admin/entrar?error=bloqueado");
    const buena = await entrar(CONTRASENA_PRUEBA, ip);
    expect(buena.headers.get("Location")).toBe("/admin/entrar?error=bloqueado");
    expect(buena.headers.get("Set-Cookie")).toBeNull();
  });

  it("cookie manipulada no autentica", async () => {
    const cookie = await cookieAdmin();
    const manipulada = `${cookie.slice(0, -4)}aaaa`;
    expect((await get("/api/admin/reporte/resumen", manipulada)).status).toBe(401);
  });

  it("verificarContrasena rechaza hashes malformados", async () => {
    expect(await verificarContrasena("x", "nada")).toBe(false);
    expect(await verificarContrasena("x", "pbkdf2$10$abc$def")).toBe(false);
  });

  it("salir borra la cookie", async () => {
    const cookie = await cookieAdmin();
    const r = await worker.fetch(
      new Request(`${BASE}/api/admin/salir`, {
        method: "POST",
        redirect: "manual",
        headers: { Cookie: cookie },
      }),
    );
    expect(r.status).toBe(303);
    expect(r.headers.get("Set-Cookie")).toContain("Max-Age=0");
  });
});

describe("roles", () => {
  it("M2: investigador no puede cruzar municipio con edad, sexo, informante ni mes; se audita", async () => {
    await sembrar(60, 9);
    const cookie = await cookieInvestigador();
    expect(
      (await get("/api/admin/reporte/geografia?periodo=2026&municipio=0801", cookie)).status,
    ).toBe(200);
    for (const q of [
      "municipio=0801&sexo=F",
      "municipio=0801&edadMin=7",
      "municipio=0801&edadMax=9",
      "municipio=0801&informante=madre",
      "municipio=0801&periodo=2026-03",
    ]) {
      const r = await get(`/api/admin/reporte/demografia?${q}`, cookie);
      expect(r.status, q).toBe(403);
    }
    // El admin sí puede.
    const admin = await cookieAdmin();
    expect((await get("/api/admin/reporte/demografia?municipio=0801&sexo=F", admin)).status).toBe(
      200,
    );
    const auditoria = await env.DB.prepare(
      "SELECT usuario, filtros FROM auditoria_admin WHERE accion = 'consulta' ORDER BY id",
    ).all<{ usuario: string; filtros: string }>();
    expect(auditoria.results.length).toBe(2);
    expect(auditoria.results[0]?.usuario).toBe("investigador@ejemplo.org");
    expect(JSON.parse(auditoria.results[0]?.filtros ?? "{}")).toMatchObject({
      reporte: "geografia",
      municipio: "0801",
    });
  });

  it("M2: los totales de resumen, volumen, calidad, investigación y comorbilidad se suprimen con n < 5", async () => {
    await sembrar(3, 21);
    const cookie = await cookieAdmin();
    const celda = { n: 0, suprimido: true };
    const resumen = await (await get("/api/admin/reporte/resumen?periodo=acumulado", cookie)).json<{
      datos: { nTotalHistorico: unknown; nPeriodo: unknown };
    }>();
    expect(resumen.datos.nTotalHistorico).toEqual(celda);
    expect(resumen.datos.nPeriodo).toEqual(celda);
    const volumen = await (await get("/api/admin/reporte/volumen?periodo=acumulado", cookie)).json<{
      datos: { totales: { total: unknown; completadas: unknown; abandonadas: unknown } };
    }>();
    expect(volumen.datos.totales.total).toEqual(celda);
    expect(volumen.datos.totales.completadas).toEqual(celda);
    expect(volumen.datos.totales.abandonadas).toEqual(celda);
    for (const nombre of ["calidad", "investigacion", "comorbilidad"]) {
      const r = await (await get(`/api/admin/reporte/${nombre}?periodo=acumulado`, cookie)).json<{
        datos: { n: unknown };
      }>();
      expect(r.datos.n, nombre).toEqual(celda);
    }
  });

  it("investigador recibe 403 en microdatos y 200 en agregados", async () => {
    const cookie = await cookieInvestigador();
    expect((await get("/api/admin/exportar?tipo=microdatos", cookie)).status).toBe(403);
    expect((await get("/api/admin/exportar?tipo=agregados&reporte=geografia", cookie)).status).toBe(
      200,
    );
    const sistema = await worker.fetch(
      new Request(`${BASE}/api/admin/sistema`, {
        method: "POST",
        headers: { Cookie: cookie },
        body: new URLSearchParams({ accion: "mantenimiento_on" }),
      }),
    );
    expect(sistema.status).toBe(403);
  });

  it("rolDeCorreo distingue admin, investigador y desconocido", () => {
    expect(rolDeCorreo("Admin@Ejemplo.org", "admin@ejemplo.org", "inv@x.org")).toBe("admin");
    expect(rolDeCorreo("inv@x.org", "admin@ejemplo.org", " inv@x.org ,otro@x.org")).toBe(
      "investigador",
    );
    expect(rolDeCorreo("nadie@x.org", "admin@ejemplo.org", "inv@x.org")).toBeNull();
  });
});

describe("Cloudflare Access (JWT RS256)", () => {
  beforeEach(() => limpiarCacheJwks());

  async function firmarJwt(claves: CryptoKeyPair, reclamos: Record<string, unknown>, kid = "k1") {
    const codificar = (o: unknown) =>
      base64UrlCodificar(new TextEncoder().encode(JSON.stringify(o)));
    const datos = `${codificar({ alg: "RS256", kid, typ: "JWT" })}.${codificar(reclamos)}`;
    const firma = await crypto.subtle.sign(
      "RSASSA-PKCS1-v1_5",
      claves.privateKey,
      new TextEncoder().encode(datos),
    );
    return `${datos}.${base64UrlCodificar(new Uint8Array(firma))}`;
  }

  it("acepta un JWT válido y rechaza firma, aud, iss y exp inválidos", async () => {
    const claves = await crypto.subtle.generateKey(
      {
        name: "RSASSA-PKCS1-v1_5",
        modulusLength: 2048,
        publicExponent: new Uint8Array([1, 0, 1]),
        hash: "SHA-256",
      },
      true,
      ["sign", "verify"],
    );
    const jwk = (await crypto.subtle.exportKey("jwk", claves.publicKey)) as JsonWebKey & {
      kid?: string;
    };
    jwk.kid = "k1";
    const obtenerJwks = async () => ({ keys: [jwk] });
    const ahora = Math.floor(Date.now() / 1000);
    const opciones = {
      teamDomain: "pruebas.cloudflareaccess.com",
      aud: "aud-de-prueba",
      obtenerJwks,
    };
    const base = {
      email: "admin@ejemplo.org",
      aud: ["aud-de-prueba"],
      iss: "https://pruebas.cloudflareaccess.com",
      exp: ahora + 600,
      iat: ahora,
    };
    const valido = await verificarJwtAccess(await firmarJwt(claves, base), opciones);
    expect(valido?.email).toBe("admin@ejemplo.org");

    const expirado = await firmarJwt(claves, { ...base, exp: ahora - 10 });
    expect(await verificarJwtAccess(expirado, opciones)).toBeNull();
    const otraAud = await firmarJwt(claves, { ...base, aud: "otra" });
    expect(await verificarJwtAccess(otraAud, opciones)).toBeNull();
    const otroIss = await firmarJwt(claves, { ...base, iss: "https://otro.cloudflareaccess.com" });
    expect(await verificarJwtAccess(otroIss, opciones)).toBeNull();
    const token = await firmarJwt(claves, base);
    const manipulado = `${token.slice(0, -6)}AAAAAA`;
    expect(await verificarJwtAccess(manipulado, opciones)).toBeNull();
    const kidDesconocido = await firmarJwt(claves, base, "k2");
    expect(await verificarJwtAccess(kidDesconocido, opciones)).toBeNull();
  });
});

describe("reportes y exportaciones con datos sintéticos", () => {
  it("geografía suprime municipios con n < 5 y expone los demás con IC95", async () => {
    const filas = generarFilas({ n: 40, semilla: 3 });
    const sentencias: D1PreparedStatement[] = [];
    filas.forEach((f, i) => {
      // 3 filas en 0102 (suprimido), 37 en 0801 (visible), todas completadas en 2026.
      const municipio = i < 3 ? "0102" : "0801";
      const ajustada = {
        ...f,
        municipio,
        departamento: municipio.slice(0, 2),
        completado: 1 as const,
        creado_en: "2026-05-10",
        periodo_anio: 2026,
      };
      sentencias.push(env.DB.prepare(SQL_INSERT).bind(...valoresInsert(ajustada)));
    });
    await env.DB.batch(sentencias);
    const cookie = await cookieAdmin();
    const r = await get("/api/admin/reporte/geografia?periodo=2026", cookie);
    expect(r.status).toBe(200);
    const { datos } = await r.json<{
      datos: {
        municipios: Array<{
          codigo: string;
          n: number;
          suprimido: boolean;
          positivo: { pct: number | null; ic95: unknown };
        }>;
        departamentos: Array<{ codigo: string; n: number; suprimido: boolean }>;
      };
    }>();
    const pequeno = datos.municipios.find((m) => m.codigo === "0102");
    const grande = datos.municipios.find((m) => m.codigo === "0801");
    expect(pequeno).toMatchObject({ n: 0, suprimido: true });
    expect(pequeno?.positivo.pct).toBeNull();
    expect(grande?.n).toBe(filas.length - 3);
    expect(grande?.suprimido).toBe(false);
    expect(typeof grande?.positivo.pct).toBe("number");
    expect(grande?.positivo.ic95).not.toBeNull();
    expect(datos.departamentos).toHaveLength(18);
    expect(datos.departamentos.find((d) => d.codigo === "01")?.suprimido).toBe(true);
  });

  it("todos los reportes responden 200 con 300 filas sembradas", async () => {
    await sembrar(300);
    const cookie = await cookieAdmin();
    for (const nombre of [
      "resumen",
      "volumen",
      "demografia",
      "puntajes",
      "comorbilidad",
      "desempeno",
      "psicometria",
      "calidad",
      "investigacion",
      "historico",
      "concordancia",
    ]) {
      const r = await get(`/api/admin/reporte/${nombre}?periodo=acumulado`, cookie);
      expect(r.status, nombre).toBe(200);
    }
    const psico = await get("/api/admin/reporte/psicometria?periodo=acumulado", cookie);
    const { datos } = await psico.json<{
      datos: {
        instrumentos: Array<{ id: string; escalas: Array<{ alfa: number | null }> }>;
        paresDSM: Array<{ n: number; correlacion: number | null }>;
      };
    }>();
    const vanderbilt = datos.instrumentos.find((i) => i.id === "vanderbilt-padres-es-1.0");
    expect(vanderbilt?.escalas[0]?.alfa).not.toBeNull();
    expect(datos.paresDSM).toHaveLength(18);
    expect(datos.paresDSM[0]?.correlacion).not.toBeNull();
    expect((await get("/api/admin/reporte/inexistente", cookie)).status).toBe(404);
  });

  it("exportar microdatos: solo consentimiento, municipio recodificado, columnas de ítems y auditoría", async () => {
    const filas = await sembrar(120, 11);
    const cookie = await cookieAdmin();
    const r = await get(
      "/api/admin/exportar?tipo=microdatos&formato=csv&periodo=acumulado",
      cookie,
    );
    expect(r.status).toBe(200);
    expect(r.headers.get("Content-Disposition")).toMatch(
      /atento-microdatos-acumulado-\d{4}-\d{2}-\d{2}\.csv/,
    );
    const bytes = new Uint8Array(await r.arrayBuffer());
    expect([bytes[0], bytes[1], bytes[2]]).toEqual([0xef, 0xbb, 0xbf]);
    const texto = new TextDecoder("utf-8", { ignoreBOM: true }).decode(bytes);
    const lineas = texto.slice(1).trim().split("\r\n");
    const cabecera = (lineas[0] as string).split(",");
    expect(cabecera).toContain("V01");
    expect(cabecera).toContain("A18");
    expect(cabecera).toContain("municipio_recodificado");
    expect(cabecera).not.toContain("creado_en");
    const esperadas = filas.filter(
      (f) => f.completado === 1 && f.consentimiento_investigacion === 1,
    ).length;
    expect(lineas.length - 1).toBe(esperadas);

    const json = await get(
      "/api/admin/exportar?tipo=microdatos&formato=json&periodo=acumulado",
      cookie,
    );
    const { datos } = await json.json<{ datos: Array<Record<string, unknown>> }>();
    const recodificadas = datos.filter((d) => d.municipio_recodificado === 1);
    expect(recodificadas.length).toBeGreaterThan(0);
    for (const d of recodificadas) expect(d.municipio).toBeNull();
    for (const d of datos) expect(String(d.mes)).toMatch(/^\d{4}-\d{2}$/);
    // A2: id seudonimizado (16 hex, no UUID) y k-anonimato sobre (depto, edad, sexo, informante).
    const idsOriginales = new Set(filas.map((f) => f.id));
    for (const d of datos) {
      expect(String(d.id)).toMatch(/^[0-9a-f]{16}$/);
      expect(idsOriginales.has(String(d.id))).toBe(false);
      expect(["6-8", "9-10", "11-12"]).toContain(d.edad_tramo);
      if (d.k_generalizado === 0) expect(typeof d.edad_anios).toBe("number");
      if ((d.k_generalizado as number) >= 1) expect(d.edad_anios).toBeNull();
      if (d.k_generalizado === 2) {
        expect(d.sexo).toBeNull();
        expect(d.informante).toBeNull();
      }
    }
    expect(datos.filter((d) => (d.k_generalizado as number) >= 1).length).toBeGreaterThan(0);
    // Ningún cruce visible (depto, edad, sexo, informante) con n < 5 en el universo del periodo.
    const universo = await env.DB.prepare(
      "SELECT departamento, edad_anios, sexo, informante, COUNT(*) AS n FROM respuestas WHERE completado = 1 GROUP BY 1, 2, 3, 4",
    ).all<{
      departamento: string;
      edad_anios: number;
      sexo: string;
      informante: string;
      n: number;
    }>();
    const conteo = new Map(
      universo.results.map((u) => [
        `${u.departamento}|${u.edad_anios}|${u.sexo}|${u.informante}`,
        u.n,
      ]),
    );
    for (const d of datos.filter((x) => x.k_generalizado === 0)) {
      const k = `${d.departamento}|${d.edad_anios}|${d.sexo}|${d.informante}`;
      expect(conteo.get(k) ?? 0, k).toBeGreaterThanOrEqual(5);
    }
    // El umbral de municipio se calcula sobre todo el periodo: filtrar por departamento no lo baja.
    const porDepto = await get(
      "/api/admin/exportar?tipo=microdatos&formato=json&periodo=acumulado&departamento=08",
      cookie,
    );
    expect(porDepto.status).toBe(200);
    const { datos: datos08 } = await porDepto.json<{ datos: Array<Record<string, unknown>> }>();
    const visiblesTodo = new Set(
      datos.filter((d) => d.municipio !== null).map((d) => String(d.municipio)),
    );
    for (const d of datos08) {
      if (d.municipio !== null) expect(visiblesTodo.has(String(d.municipio))).toBe(true);
    }
    // Filtros finos y periodos no anuales -> 400.
    for (const q of [
      "municipio=0801",
      "sexo=F",
      "edadMin=7",
      "informante=madre",
      "periodo=2026-03",
    ]) {
      const r = await get(`/api/admin/exportar?tipo=microdatos&${q}`, cookie);
      expect(r.status, q).toBe(400);
      expect(((await r.json()) as { error: string }).error).toContain("microdatos");
    }

    const auditoria = await env.DB.prepare(
      "SELECT usuario, accion, filtros, filas FROM auditoria_admin WHERE accion = 'exportar_microdatos' ORDER BY id",
    ).all<{ usuario: string; accion: string; filtros: string; filas: number }>();
    expect(auditoria.results).toHaveLength(3); // csv, json y json por departamento;
    expect(auditoria.results[0]?.filas).toBe(esperadas);
    expect(JSON.parse(auditoria.results[0]?.filtros ?? "{}")).toMatchObject({
      periodo: "acumulado",
      formato: "csv",
    });
  });

  it("exportar agregados y codebook quedan en auditoría", async () => {
    await sembrar(60, 5);
    const cookie = await cookieInvestigador();
    const csv = await get(
      "/api/admin/exportar?tipo=agregados&reporte=demografia&periodo=acumulado",
      cookie,
    );
    expect(csv.status).toBe(200);
    expect(csv.headers.get("Content-Type")).toContain("text/csv");
    const codebook = await get("/api/admin/exportar?tipo=codebook", cookie);
    expect(codebook.status).toBe(200);
    expect(await codebook.text()).toContain("# Codebook");
    const auditoria = await env.DB.prepare(
      "SELECT accion, usuario FROM auditoria_admin WHERE usuario = ? ORDER BY id",
    )
      .bind("investigador@ejemplo.org")
      .all<{ accion: string; usuario: string }>();
    const acciones = auditoria.results.map((a) => a.accion);
    expect(acciones).toContain("exportar_agregados");
    expect(acciones).toContain("exportar_codebook");
    expect(auditoria.results.length).toBeGreaterThanOrEqual(2);
  });
});

describe("B7: trigger de validación en respuestas (migración 0003)", () => {
  it("rechaza items no JSON, codigo_vinculo de otra longitud y version_consentimiento sin formato", async () => {
    const [fila] = generarFilas({ n: 1, semilla: 5 });
    if (!fila) throw new Error("sin fila");
    const insertar = (f: typeof fila) =>
      env.DB.prepare(SQL_INSERT)
        .bind(...valoresInsert(f))
        .run();
    await expect(insertar({ ...fila, id: crypto.randomUUID() })).resolves.toBeTruthy();
    await expect(
      insertar({ ...fila, id: crypto.randomUUID(), version_consentimiento: "v1" }),
    ).rejects.toThrow(/version_consentimiento/);
    const valores = valoresInsert({ ...fila, id: crypto.randomUUID() });
    valores[8] = "{no es json";
    await expect(
      env.DB.prepare(SQL_INSERT)
        .bind(...valores)
        .run(),
    ).rejects.toThrow(/items/);
    const minimo =
      "INSERT INTO respuestas (id, creado_en, periodo_anio, departamento, municipio, edad_anios, items, version_consentimiento, version_instrumento, codigo_vinculo) VALUES (?, '2026-01-01', 2026, '08', '0801', 8, '{}', '2026-10-11', 'x', ?)";
    await expect(env.DB.prepare(minimo).bind(crypto.randomUUID(), "abc").run()).rejects.toThrow(
      /codigo_vinculo/,
    );
    await expect(
      env.DB.prepare(minimo).bind(crypto.randomUUID(), "ABCD1234").run(),
    ).resolves.toBeTruthy();
    await expect(
      env.DB.prepare(minimo).bind(crypto.randomUUID(), null).run(),
    ).resolves.toBeTruthy();
  });
});

describe("sistema", () => {
  it("activa y desactiva el mantenimiento y registra la acción", async () => {
    const cookie = await cookieAdmin();
    const enviar = (accion: string) =>
      worker.fetch(
        new Request(`${BASE}/api/admin/sistema`, {
          method: "POST",
          headers: { Cookie: cookie, Accept: "application/json" },
          body: new URLSearchParams({ accion }),
        }),
      );
    const on = await enviar("mantenimiento_on");
    expect(on.status).toBe(200);
    let fila = await env.DB.prepare(
      "SELECT valor FROM configuracion WHERE clave = 'mantenimiento'",
    ).first<{ valor: string }>();
    expect(fila?.valor).toBe("1");
    await enviar("mantenimiento_off");
    fila = await env.DB.prepare(
      "SELECT valor FROM configuracion WHERE clave = 'mantenimiento'",
    ).first<{ valor: string }>();
    expect(fila?.valor).toBe("0");
    const recalcular = await enviar("recalcular_agregados");
    const cuerpo = await recalcular.json<{ mensaje: string }>();
    expect(["recalculo-pendiente", "recalculo-ok", "recalculo-error"]).toContain(cuerpo.mensaje);
    expect((await enviar("otra")).status).toBe(400);
  });
});

/** Respuestas de un instrumento con frecuencia y desempeño fijos. */
function respuestasDe(instrumentoId: string, frecuencia: number, desempeno = 3) {
  const r: Record<string, number> = {};
  for (const item of obtenerInstrumento(instrumentoId).items) {
    r[item.id] = item.tipo === "desempeno" ? desempeno : frecuencia;
  }
  return r;
}

/** Inserta una respuesta real (puntuada por construirFila) de familia o docente. */
async function insertarEnvio(opciones: {
  docente: boolean;
  codigo: string | null;
  frecuencia: number;
  desempeno?: number;
  fecha?: string;
  consentimiento?: boolean;
}) {
  const instrumentoId = opciones.docente ? "vanderbilt-docente-es-1.0" : "vanderbilt-padres-es-1.0";
  const envio: Envio = {
    id: crypto.randomUUID(),
    instrumentoId,
    respuestas: respuestasDe(instrumentoId, opciones.frecuencia, opciones.desempeno ?? 3),
    departamento: "08",
    municipio: "0801",
    edadAnios: 8,
    sexo: "F",
    informante: opciones.docente ? "docente" : "madre",
    consentimientoInvestigacion: opciones.consentimiento ?? true,
    versionConsentimiento: opciones.docente ? "2026-10-12" : "2026-10-11",
    duracionSegundos: 400,
    completado: true,
    turnstileToken: "t",
    hp: "",
  };
  if (opciones.codigo) envio.codigoVinculo = opciones.codigo;
  const fila = construirFila(envio, new Date(`${opciones.fecha ?? "2026-05-10"}T12:00:00Z`));
  await env.DB.prepare(SQL_INSERTAR_RESPUESTA)
    .bind(...parametrosRespuesta(fila))
    .run();
  return fila;
}

describe("versión docente en el panel", () => {
  type Concordancia = {
    datos: {
      pares: { n: number; suprimido: boolean };
      docentesSinCodigo: { n: number; suprimido: boolean };
      codigosRepetidos: { n: number; suprimido: boolean };
      dosEntornos: { pct: number | null; suprimido: boolean };
      acuerdo: Array<{
        escala: string;
        acuerdo: { pct: number | null };
        kappa: { valor: number } | null;
        tabla: Record<string, { n: number; suprimido: boolean }>;
      }>;
      correlacion: Array<{ escala: string; r: number | null }>;
    };
  };

  it("concordancia: con 4 pares suprime todo; con 8 pares calcula acuerdo, kappa y dos entornos", async () => {
    const cookie = await cookieAdmin();
    // 4 pares: menos de 5 -> todo suprimido.
    for (let i = 0; i < 4; i++) {
      const codigo = `PAR0000${i}`;
      await insertarEnvio({ docente: false, codigo, frecuencia: 3 });
      await insertarEnvio({ docente: true, codigo, frecuencia: 3 });
    }
    const r1 = await get("/api/admin/reporte/concordancia?periodo=2026", cookie);
    expect(r1.status).toBe(200);
    const c1 = (await r1.json<Concordancia>()).datos;
    expect(c1.pares).toEqual({ n: 0, suprimido: true });
    expect(c1.dosEntornos.suprimido).toBe(true);
    expect(c1.acuerdo.every((a) => a.kappa === null && a.acuerdo.pct === null)).toBe(true);

    // 4 pares más (3 negativos en ambos, 1 positivo solo en la familia) = 8 pares.
    for (let i = 4; i < 7; i++) {
      const codigo = `PAR0000${i}`;
      await insertarEnvio({ docente: false, codigo, frecuencia: 0 });
      await insertarEnvio({ docente: true, codigo, frecuencia: 0 });
    }
    await insertarEnvio({ docente: false, codigo: "PAR00007", frecuencia: 3 });
    await insertarEnvio({ docente: true, codigo: "PAR00007", frecuencia: 0 });
    // Fila repetida de la familia, más antigua: se usa la más reciente (la de arriba).
    await insertarEnvio({ docente: false, codigo: "PAR00007", frecuencia: 0, fecha: "2026-02-01" });
    // Docentes sin código y familia sin pareja: no forman par.
    for (let i = 0; i < 5; i++) await insertarEnvio({ docente: true, codigo: null, frecuencia: 1 });
    await insertarEnvio({ docente: false, codigo: "SOLOFAM1", frecuencia: 2 });

    const r2 = await get("/api/admin/reporte/concordancia?periodo=2026", cookie);
    const c2 = (await r2.json<Concordancia>()).datos;
    expect(c2.pares).toEqual({ n: 8, suprimido: false });
    expect(c2.docentesSinCodigo).toEqual({ n: 5, suprimido: false });
    const inat = c2.acuerdo.find((a) => a.escala === "inatencion");
    // Tabla: ambos 4, solo familia 1, solo docente 0, ninguno 3 (celdas < 5 suprimidas).
    expect(inat?.tabla.ambos).toEqual({ n: 0, suprimido: true });
    expect(inat?.acuerdo.pct).toBe(87.5);
    // κ = (7/8 − 0,5) / (1 − 0,5) con pA = 5/8 y pB = 4/8 → pe = 0,5 → κ = 0,75.
    expect(inat?.kappa?.valor).toBeCloseTo(0.75, 3);
    expect(c2.dosEntornos.pct).toBe(50);
    expect(c2.correlacion.find((x) => x.escala === "inatencion")?.r).not.toBeNull();
    // Los filtros de periodo aplican: en 2025 no hay pares.
    const r3 = await get("/api/admin/reporte/concordancia?periodo=2025", cookie);
    expect((await r3.json<Concordancia>()).datos.pares).toEqual({ n: 0, suprimido: true });
    // Cada consulta queda en auditoría.
    const auditoria = await env.DB.prepare(
      "SELECT filtros FROM auditoria_admin WHERE accion = 'consulta' ORDER BY id",
    ).all<{ filtros: string }>();
    const reportes = auditoria.results.map((a) => JSON.parse(a.filtros).reporte);
    expect(reportes.filter((x) => x === "concordancia")).toHaveLength(3);
  });

  it("los reportes filtran por el instrumento docente (versionInstrumento)", async () => {
    const cookie = await cookieAdmin();
    for (let i = 0; i < 6; i++)
      await insertarEnvio({ docente: true, codigo: null, frecuencia: 2, desempeno: 4 });
    for (let i = 0; i < 7; i++)
      await insertarEnvio({ docente: false, codigo: null, frecuencia: 0 });
    const q = "periodo=2026&versionInstrumento=vanderbilt-docente-es-1.0";
    const resumen = await get(`/api/admin/reporte/resumen?${q}`, cookie);
    const { datos: rd } = await resumen.json<{ datos: { nPeriodo: { n: number } } }>();
    expect(rd.nPeriodo.n).toBe(6);
    const des = await get(`/api/admin/reporte/desempeno?${q}`, cookie);
    const { datos: dd } = await des.json<{
      datos: { items: Array<{ id: string; n: number; conProblemas: { pct: number | null } }> };
    }>();
    expect(dd.items.map((x) => x.id)).toEqual([
      "T36",
      "T37",
      "T38",
      "T39",
      "T40",
      "T41",
      "T42",
      "T43",
    ]);
    expect(dd.items[0]?.n).toBe(6);
    expect(dd.items[0]?.conProblemas.pct).toBe(100);
    const punt = await get(`/api/admin/reporte/puntajes?${q}`, cookie);
    const { datos: pd } = await punt.json<{
      datos: {
        escalas: Array<{
          escala: string;
          n: number;
          histograma: Array<{ desde: number; hasta: number }>;
        }>;
      };
    }>();
    const desempeno = pd.escalas.find((e) => e.escala === "desempeno");
    expect(desempeno?.n).toBe(6);
    expect(desempeno?.histograma[0]?.desde).toBe(8);
    expect(desempeno?.histograma.at(-1)?.hasta).toBe(40);
  });

  it("microdatos: columnas T01–T43 y par_id (HMAC por descarga); nunca codigo_vinculo", async () => {
    const cookie = await cookieAdmin();
    for (let i = 0; i < 5; i++) {
      await insertarEnvio({ docente: false, codigo: `MICRO00${i}`, frecuencia: 1 });
      await insertarEnvio({ docente: true, codigo: `MICRO00${i}`, frecuencia: 1 });
    }
    await insertarEnvio({ docente: false, codigo: null, frecuencia: 1 });
    const csv = await get("/api/admin/exportar?tipo=microdatos&formato=csv&periodo=2026", cookie);
    expect(csv.status).toBe(200);
    const texto = await csv.text();
    const cabecera = (texto.replace(/^\uFEFF/, "").split("\r\n")[0] as string).split(",");
    expect(cabecera).toContain("par_id");
    expect(cabecera).toContain("T01");
    expect(cabecera).toContain("T43");
    expect(cabecera).not.toContain("codigo_vinculo");
    expect(texto).not.toContain("MICRO00");

    const json = await get("/api/admin/exportar?tipo=microdatos&formato=json&periodo=2026", cookie);
    const { datos } = await json.json<{ datos: Array<Record<string, unknown>> }>();
    expect(datos).toHaveLength(11);
    for (const d of datos) expect(d).not.toHaveProperty("codigo_vinculo");
    const conPar = datos.filter((d) => d.par_id !== null);
    expect(conPar).toHaveLength(10);
    for (const d of conPar) expect(String(d.par_id)).toMatch(/^[0-9a-f]{16}$/);
    // Cada par_id agrupa exactamente una fila de familia y una de docente.
    const grupos = new Map<string, string[]>();
    for (const d of conPar) {
      const lista = grupos.get(String(d.par_id)) ?? [];
      lista.push(String(d.version_instrumento));
      grupos.set(String(d.par_id), lista);
    }
    expect(grupos.size).toBe(5);
    for (const lista of grupos.values()) {
      expect(lista.sort()).toEqual(["vanderbilt-docente-es-1.0", "vanderbilt-padres-es-1.0"]);
    }
    const docente = datos.find((d) => d.version_instrumento === "vanderbilt-docente-es-1.0");
    expect(docente?.T01).toBe(1);
    expect(docente?.V01).toBeNull();
    expect(datos.find((d) => d.par_id === null)?.version_instrumento).toBe(
      "vanderbilt-padres-es-1.0",
    );
    // El codebook documenta par_id y la versión docente.
    const codebook = await (await get("/api/admin/exportar?tipo=codebook", cookie)).text();
    expect(codebook).toContain("par_id");
    expect(codebook).toContain("vanderbilt-docente-es-1.0");
    expect(codebook).toContain("| T43 |");
  });
});
