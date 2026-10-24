import type { ActionResult } from "@/lib/action-types";
import { NETWORK_ERROR_MESSAGE } from "@/lib/domain/errors";

/** Appelle une action serveur côté client sans jamais laisser remonter d'exception réseau. */
export async function safeAction<T>(fn: () => Promise<ActionResult<T>>): Promise<ActionResult<T>> {
  try {
    return await fn();
  } catch (error) {
    // Les redirections de Next.js doivent continuer à fonctionner.
    if (error && typeof error === "object" && "digest" in error && String((error as { digest: unknown }).digest).startsWith("NEXT_REDIRECT")) {
      throw error;
    }
    return { ok: false, message: NETWORK_ERROR_MESSAGE };
  }
}
