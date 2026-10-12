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
import { CONTRASENA_PRUEBA } from "./admin-constantes";

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
