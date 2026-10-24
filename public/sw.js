/*
 * Service worker — Stade du 26 Mars
 *
 * Rôle : rendre l'application installable et afficher une page claire hors
 * connexion. PAR CONCEPTION, aucune page authentifiée ni donnée (matricules,
 * passages, abonnements) n'est mise en cache : seules les ressources
 * statiques versionnées et la page « hors ligne » le sont.
 */
const VERSION = "v1";
const STATIC_CACHE = `stade26-static-${VERSION}`;
const OFFLINE_URL = "/hors-ligne";
const PRECACHE = [OFFLINE_URL, "/icons/icon-192.png", "/icons/icon-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(STATIC_CACHE).then((cache) => cache.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith("stade26-") && k !== STATIC_CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Navigation : toujours le réseau ; page hors ligne en cas d'échec.
  if (request.mode === "navigate") {
    event.respondWith(fetch(request).catch(() => caches.match(OFFLINE_URL)));
    return;
  }

  // Ressources statiques immuables de Next.js et icônes : cache d'abord.
  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/")) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((response) => {
            if (response.ok) {
              const copy = response.clone();
              caches.open(STATIC_CACHE).then((cache) => cache.put(request, copy));
            }
            return response;
          }),
      ),
    );
  }
});
