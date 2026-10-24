"use client";

import { useEffect } from "react";

/** Enregistre le service worker (production uniquement, pour éviter les caches obsolètes en développement). */
export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {
      // L'application fonctionne sans service worker ; seule l'installation est affectée.
    });
  }, []);
  return null;
}
