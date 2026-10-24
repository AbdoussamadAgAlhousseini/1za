import type { MetadataRoute } from "next";

/** Application installable (PWA) : bureau de l'administrateur, téléphones des agents. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Stade du 26 Mars — Gestion des sportifs",
    short_name: "Stade 26 Mars",
    description: "Contrôle des accès, abonnements et fréquentation du Stade du 26 Mars.",
    lang: "fr",
    dir: "ltr",
    start_url: "/",
    scope: "/",
    display: "standalone",
    display_override: ["window-controls-overlay", "standalone"],
    orientation: "any",
    background_color: "#f5f3ed",
    theme_color: "#0f4a37",
    categories: ["business", "sports", "productivity"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Contrôle d'accès", short_name: "Contrôle", url: "/controle", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
    ],
  };
}
