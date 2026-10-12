/*
 * Service worker de Atento (PWA ligera).
 *
 * - App shell precacheado y estrategias por tipo de petición:
 *   · navegaciones (HTML): network-first con copia en caché y fallback a /offline;
 *   · recursos del mismo origen (CSS/JS/imágenes/fuentes): stale-while-revalidate.
 * - NUNCA cachea /api/* ni /admin/*.
 * - Cola de envíos: si `POST /api/respuesta` falla por red, el cuerpo (sin datos identificables:
 *   municipio, edad, sexo, informante y respuestas) se guarda en IndexedDB (`atento-cola`) y se
 *   reintenta con Background Sync (tag `atento-envio`) o en el siguiente arranque del SW.
 *   Un reintento puede ser rechazado por el servidor (p. ej. token antibots vencido): en ese caso
 *   se descarta, porque un 4xx no se resuelve reintentando.
 *
 * Se sirve desde public/ para que no dependa de nombres de build; no necesita nonce porque no es
 * un script inline. Sube VERSION para invalidar la caché anterior.
 */

const VERSION = "v1";
const CACHE = `atento-${VERSION}`;
const DB_NOMBRE = "atento-cola";
const DB_ALMACEN = "envios";
const TAG_SYNC = "atento-envio";
const MAX_INTENTOS = 5;

const APP_SHELL = [
  "/",
  "/cribado/consentimiento",
  "/cribado/datos",
  "/cribado/cuestionario",
  "/resultado",
  "/offline",
  "/manifest.webmanifest",
  "/marca/favicon.svg",
  "/marca/icono-192.png",
  "/marca/logo.svg",
];

const RUTAS_SIN_CACHE = ["/api/", "/admin"];

function esRutaSinCache(pathname) {
  return RUTAS_SIN_CACHE.some((p) => pathname.startsWith(p));
}

// ---------- Instalación y activación ----------

self.addEventListener("install", (ev) => {
  ev.waitUntil(
    caches.open(CACHE).then(async (cache) => {
      // Cada ruta por separado: si una falla (p. ej. mantenimiento), el resto se precachea igual.
      await Promise.allSettled(
        APP_SHELL.map(async (ruta) => {
          const r = await fetch(ruta, { credentials: "same-origin" });
          if (r.ok) await cache.put(ruta, r);
        }),
      );
      await self.skipWaiting();
    }),
  );
});

self.addEventListener("activate", (ev) => {
  ev.waitUntil(
    (async () => {
      const claves = await caches.keys();
      await Promise.all(claves.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
      await self.clients.claim();
      // Reintento de la cola al arrancar (navegadores sin Background Sync).
      await vaciarCola();
    })(),
  );
});

// ---------- Fetch ----------

self.addEventListener("fetch", (ev) => {
  const req = ev.request;
  const url = new URL(req.url);

  if (url.origin !== self.location.origin) return;

  if (req.method === "POST" && url.pathname === "/api/respuesta") {
    ev.respondWith(enviarConCola(req));
    return;
  }

  if (req.method !== "GET" || esRutaSinCache(url.pathname)) return;

  if (req.mode === "navigate") {
    ev.respondWith(redPrimero(req));
    return;
  }

  ev.respondWith(cachePrimeroRevalidando(req));
});

async function redPrimero(req) {
  const cache = await caches.open(CACHE);
  try {
    const r = await fetch(req);
    if (r.ok && r.type === "basic") cache.put(req, r.clone()).catch(() => {});
    return r;
  } catch {
    const enCache = await cache.match(req, { ignoreSearch: true });
    if (enCache) return enCache;
    const offline = await cache.match("/offline");
    if (offline) return offline;
    return new Response("Sin conexión", {
      status: 503,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }
}

async function cachePrimeroRevalidando(req) {
  const cache = await caches.open(CACHE);
  const enCache = await cache.match(req);
  const red = fetch(req)
    .then((r) => {
      if (r.ok && r.type === "basic") cache.put(req, r.clone()).catch(() => {});
      return r;
    })
    .catch(() => undefined);
  if (enCache) return enCache;
  const r = await red;
  return r ?? new Response("", { status: 504 });
}

// ---------- Cola de envíos ----------

async function enviarConCola(req) {
  const cuerpo = await req.clone().text();
  try {
    return await fetch(req);
  } catch {
    // Fallo de red (no una respuesta del servidor): se encola y se avisa al cliente.
    await encolar(cuerpo);
    await registrarSync();
    return new Response(JSON.stringify({ ok: false, motivo: "en_cola" }), {
      status: 503,
      headers: { "Content-Type": "application/json; charset=utf-8" },
    });
  }
}

async function registrarSync() {
  try {
    if ("sync" in self.registration) await self.registration.sync.register(TAG_SYNC);
  } catch {
    // Sin Background Sync: se reintenta en el próximo arranque del SW.
  }
}

self.addEventListener("sync", (ev) => {
  if (ev.tag === TAG_SYNC) ev.waitUntil(vaciarCola());
});

self.addEventListener("message", (ev) => {
  if (ev.data === "atento:reintentar") ev.waitUntil(vaciarCola());
});

async function vaciarCola() {
  let pendientes = [];
  try {
    pendientes = await listarCola();
  } catch {
    return;
  }
  for (const item of pendientes) {
    let r;
    try {
      r = await fetch("/api/respuesta", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: item.cuerpo,
      });
    } catch {
      // Sigue sin red: se conserva y se vuelve a intentar.
      const intentos = (item.intentos ?? 0) + 1;
      if (intentos >= MAX_INTENTOS) await borrarDeCola(item.id);
      else await actualizarIntentos(item.id, intentos);
      throw new Error("sin red");
    }
    // 2xx = guardado; 4xx = no reintentable (validación, token vencido, duplicado).
    if (r.status < 500) {
      await borrarDeCola(item.id);
    } else {
      const intentos = (item.intentos ?? 0) + 1;
      if (intentos >= MAX_INTENTOS) await borrarDeCola(item.id);
      else await actualizarIntentos(item.id, intentos);
    }
  }
}

// ---------- IndexedDB mínima ----------

function abrirDb() {
  return new Promise((resolver, rechazar) => {
    const pet = indexedDB.open(DB_NOMBRE, 1);
    pet.onupgradeneeded = () => {
      const db = pet.result;
      if (!db.objectStoreNames.contains(DB_ALMACEN)) {
        db.createObjectStore(DB_ALMACEN, { keyPath: "id", autoIncrement: true });
      }
    };
    pet.onsuccess = () => resolver(pet.result);
    pet.onerror = () => rechazar(pet.error);
  });
}

function transaccion(modo, accion) {
  return abrirDb().then(
    (db) =>
      new Promise((resolver, rechazar) => {
        const tx = db.transaction(DB_ALMACEN, modo);
        const pet = accion(tx.objectStore(DB_ALMACEN));
        tx.oncomplete = () => {
          db.close();
          resolver(pet ? pet.result : undefined);
        };
        tx.onerror = () => {
          db.close();
          rechazar(tx.error);
        };
      }),
  );
}

function encolar(cuerpo) {
  return transaccion("readwrite", (st) =>
    st.add({ cuerpo, intentos: 0, creado: new Date().toISOString() }),
  );
}

function listarCola() {
  return transaccion("readonly", (st) => st.getAll());
}

function borrarDeCola(id) {
  return transaccion("readwrite", (st) => st.delete(id));
}

function actualizarIntentos(id, intentos) {
  return transaccion("readwrite", (st) => {
    const pet = st.get(id);
    pet.onsuccess = () => {
      if (pet.result) st.put({ ...pet.result, intentos });
    };
    return undefined;
  });
}
