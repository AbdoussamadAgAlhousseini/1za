"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/server/auth";
import { fail, fromDbError, fromZodError } from "@/server/action-result";
import type { ActionResult } from "@/lib/action-types";
import { reasonSchema, uuidSchema } from "@/lib/validation/common";
import { zonedLocalToUtcIso } from "@/lib/domain/timezone";

const correctionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("close"), visitId: uuidSchema, exitedAtLocal: z.string().min(1, "Indiquez l'heure de sortie."), reason: reasonSchema }),
  z.object({ action: z.literal("cancel"), visitId: uuidSchema, reason: reasonSchema }),
]);

export async function correctVisit(input: z.input<typeof correctionSchema>): Promise<ActionResult> {
  const staff = await requireAdmin();
  const parsed = correctionSchema.safeParse(input);
  if (!parsed.success) return fromZodError(parsed.error);
  const v = parsed.data;

  let exitedAt: string | null = null;
  if (v.action === "close") {
    exitedAt = zonedLocalToUtcIso(v.exitedAtLocal, staff.timezone);
    if (!exitedAt) return fail("Heure de sortie invalide.", { exitedAtLocal: "Heure invalide." });
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_correct_visit", {
    p_visit_id: v.visitId,
    p_action: v.action,
    p_exited_at: exitedAt as string,
    p_reason: v.reason,
  });
  if (error) {
    const res = fromDbError(error, "admin_correct_visit");
    if (!res.ok && res.code === "ERR_DATE_INVALID")
      return { ...res, message: "L'heure de sortie doit être postérieure à l'entrée et ne peut pas être dans le futur.", fieldErrors: { exitedAtLocal: "Heure incohérente." } };
    return res;
  }

  revalidatePath("/frequentation");
  revalidatePath("/tableau-de-bord");
  return { ok: true, data: undefined, message: v.action === "close" ? "Sortie corrigée et journalisée." : "Passage annulé et journalisé." };
}
