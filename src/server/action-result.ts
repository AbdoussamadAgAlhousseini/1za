import "server-only";
import type { z } from "zod";
import { extractErrorCode, messageForError, GENERIC_ERROR_MESSAGE } from "@/lib/domain/errors";
import type { ActionResult } from "@/lib/action-types";

export function fail(message: string, fieldErrors?: Record<string, string>): ActionResult<never> {
  return { ok: false, message, fieldErrors };
}

export function fromZodError(error: z.ZodError): ActionResult<never> {
  const fieldErrors: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_form";
    if (!fieldErrors[key]) fieldErrors[key] = issue.message;
  }
  return { ok: false, message: "Certains champs sont à corriger.", fieldErrors };
}

/**
 * Convertit une erreur Supabase en message utilisateur. Les erreurs non
 * métier sont journalisées côté serveur sans données personnelles et
 * remplacées par un message générique.
 */
export function fromDbError(error: unknown, context: string): ActionResult<never> {
  if (!extractErrorCode(error)) {
    const code = error && typeof error === "object" && "code" in error ? String((error as { code: unknown }).code) : "unknown";
    console.error(`[${context}] erreur base de données (code ${code})`);
    return { ok: false, message: GENERIC_ERROR_MESSAGE };
  }
  return { ok: false, message: messageForError(error), code: extractErrorCode(error) ?? undefined };
}
