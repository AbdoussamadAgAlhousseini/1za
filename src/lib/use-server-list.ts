"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import type { ActionResult } from "@/lib/action-types";
import { safeAction } from "@/lib/safe-action";

/**
 * Liste paginée côté serveur : les filtres restent dans l'état du composant
 * (jamais dans l'URL : pas de matricule dans les journaux techniques) et sont
 * envoyés à une action serveur, avec un léger délai pendant la frappe.
 */
export function useServerList<F extends { page: number }, D>(
  action: (filters: F) => Promise<ActionResult<D>>,
  initialFilters: F,
  initialData: D | null,
) {
  const [filters, setFilters] = useState<F>(initialFilters);
  const [data, setData] = useState<D | null>(initialData);
  const [error, setError] = useState<string | null>(initialData ? null : "Les données n'ont pas pu être chargées.");
  const [pending, startTransition] = useTransition();
  const [version, setVersion] = useState(0);
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const id = window.setTimeout(() => {
      startTransition(async () => {
        const res = await safeAction(() => action(filters));
        if (res.ok) {
          setData(res.data);
          setError(null);
        } else setError(res.message);
      });
    }, 220);
    return () => window.clearTimeout(id);
  }, [filters, action, version]);

  return {
    filters,
    data,
    error,
    pending,
    /** Modifie des filtres (retour à la page 1). */
    update: (patch: Partial<Omit<F, "page">>) => setFilters((f) => ({ ...f, ...patch, page: 1 })),
    setPage: (page: number) => setFilters((f) => ({ ...f, page })),
    reset: () => setFilters(initialFilters),
    reload: () => setVersion((v) => v + 1),
  };
}
