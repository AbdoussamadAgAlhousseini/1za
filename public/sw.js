/*
 * Service worker — Stade du 26 Mars
 *
 * Même principe que LAKOL : les pages utiles sans réseau sont mises en cache
 * (réseau d'abord, cache en secours) et la page signale ses scripts pour qu'ils
 * restent disponibles. Ici, seule la page du poste de contrôle est concernée :
 * l'agent peut ouvrir l'application et contrôler sans connexion.
 *
 * Le cache des pages est vidé à la déconnexion. Aucune autre page authentifiée
 * (listes, statistiques, paiements) n'est conservée sur l'appareil.
 */
const VERSION = "v2";
const STATIC_CACHE = `stade26-static-${VERSION}`;
const PAGES_CACHE = `stade26-pages-${VERSION}`;
const OFFLINE_URL = "/hors-ligne";
const PRECACHE = [OFFLINE_URL, "/icons/icon-192.png", "/icons/icon-512.png", "/manifest.webmanifest"];
const OFFLINE_PAGES = /^\/controle\/?$/;

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith("stade26-") && !k.endsWith(VERSION)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

async function networkFirst(request, cacheable) {
  const cache = await caches.open(PAGES_CACHE);
  try {
    const response = await fetch(request);
    if (cacheable && response.ok && !response.redirected) await cache.put(request, response.clone());
    return response;
  } catch {
    const cached = await cache.match(request);
    if (cached) return cached;
    return (await caches.match(OFFLINE_URL)) ?? Response.error();
  }
}

self.addEventListener("message", (event) => {
  const data = event.data;
  // Déconnexion : on oublie les pages de l'utilisateur.
  if (data?.type === "clear-pages") {
    event.waitUntil(caches.delete(PAGES_CACHE));
    return;
  }
  // Scripts et styles déjà chargés par la page (avant que le service worker ne
  // la contrôle) : conservés pour que la page reste interactive hors ligne.
  if (data?.type === "cache-assets" && Array.isArray(data.urls)) {
    const urls = data.urls.filter((u) => {
      try {
        const url = new URL(u);
        return url.origin === self.location.origin && url.pathname.startsWith("/_next/static/");
      } catch {
        return false;
      }
    });
    event.waitUntil(
      caches.open(STATIC_CACHE).then(async (cache) => {
        for (const u of urls) if (!(await cache.match(u))) await cache.add(u).catch(() => undefined);
      }),
    );
  }
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Retour à la connexion (déconnexion, session expirée) : cache des pages vidé.
  if (request.mode === "navigate" && /^\/connexion\/?$/.test(url.pathname)) {
    event.waitUntil(caches.delete(PAGES_CACHE));
    return;
  }

  // Fichiers versionnés de Next.js, icônes : cache d'abord.
  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/")) {
    event.respondWith(
      caches.match(request).then(
        (hit) =>
          hit ??
          fetch(request).then((response) => {
            if (response.ok) {
              const copy = response.clone();
              caches.open(STATIC_CACHE).then((cache) => cache.put(request, copy));
            }
            return response;
          }),
      ),
    );
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(networkFirst(request, OFFLINE_PAGES.test(url.pathname)));
  }
});
