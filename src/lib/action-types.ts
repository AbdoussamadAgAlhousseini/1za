import type { ErrorCode } from "@/lib/domain/errors";

/** Résultat uniforme des actions serveur. */
export type ActionResult<T = undefined> =
  | { ok: true; data: T; message?: string }
  | { ok: false; message: string; code?: ErrorCode; fieldErrors?: Record<string, string> };

export const IDLE_RESULT = null;
