"use client";

import { useEffect } from "react";

/**
 * Enregistre le service worker (production uniquement, pour éviter les caches
 * obsolètes en développement) et lui signale les scripts déjà chargés afin que
 * le poste de contrôle reste utilisable sans réseau.
 */
export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    const sendAssets = (worker: ServiceWorker | null | undefined) => {
      const urls = performance
        .getEntriesByType("resource")
        .map((e) => e.name)
        .filter((u) => u.includes("/_next/static/"));
      worker?.postMessage({ type: "cache-assets", urls });
    };
    navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .then(async () => {
        const ready = await navigator.serviceWorker.ready;
        sendAssets(ready.active);
      })
      .catch(() => {
        // L'application fonctionne sans service worker ; seuls l'installation et le hors-ligne sont affectés.
      });
  }, []);
  return null;
}

/** Efface les données hors ligne de l'appareil (déconnexion). */
export async function clearDeviceData() {
  try {
    const { offlineStore } = await import("@/lib/offline/store");
    await offlineStore.clear();
  } catch {
    /* rien à effacer */
  }
  try {
    navigator.serviceWorker?.controller?.postMessage({ type: "clear-pages" });
  } catch {
    /* pas de service worker */
  }
}
