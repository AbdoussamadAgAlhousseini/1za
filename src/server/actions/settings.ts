"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/server/auth";
import { fromDbError, fromZodError } from "@/server/action-result";
import type { ActionResult } from "@/lib/action-types";

const settingsSchema = z.object({
  stadiumName: z.string().trim().min(2, "2 caractères minimum.").max(80),
  timezone: z.string().min(3).max(64),
  expiringSoonDays: z.coerce.number().int().min(1, "Entre 1 et 60 jours.").max(60, "Entre 1 et 60 jours."),
  longVisitHours: z.coerce.number().int().min(1, "Entre 1 et 24 heures.").max(24, "Entre 1 et 24 heures."),
  defaultCurrency: z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/, "Code sur 3 lettres (ex. XOF)."),
  offlineSnapshotHours: z.coerce.number().int().min(1, "Entre 1 et 72 heures.").max(72, "Entre 1 et 72 heures."),
});

export async function updateSettings(input: z.input<typeof settingsSchema>): Promise<ActionResult> {
  await requireAdmin();
  const parsed = settingsSchema.safeParse(input);
  if (!parsed.success) return fromZodError(parsed.error);
  const v = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_update_settings", {
    p_stadium_name: v.stadiumName,
    p_timezone: v.timezone,
    p_expiring_soon_days: v.expiringSoonDays,
    p_long_visit_hours: v.longVisitHours,
    p_default_currency: v.defaultCurrency,
    p_offline_snapshot_hours: v.offlineSnapshotHours,
  });
  if (error) {
    const res = fromDbError(error, "admin_update_settings");
    return res.ok ? res : { ...res, fieldErrors: res.code === "ERR_INVALID_INPUT" ? { timezone: "Fuseau horaire inconnu." } : undefined };
  }
  revalidatePath("/", "layout");
  return { ok: true, data: undefined, message: "Paramètres enregistrés." };
}

const planSchema = z.object({
  id: z.uuid().nullable(),
  name: z.string().trim().min(2, "2 caractères minimum.").max(60, "60 caractères maximum."),
  durationDays: z.coerce.number().int().min(1, "Au moins 1 jour.").max(3660, "10 ans maximum."),
  price: z
    .union([z.literal(""), z.coerce.number().min(0, "Le prix ne peut pas être négatif.").max(100_000_000)])
    .transform((v) => (v === "" ? null : v)),
  currency: z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/, "Code sur 3 lettres (ex. XOF)."),
  isActive: z.boolean(),
});

export async function savePlan(input: z.input<typeof planSchema>): Promise<ActionResult<{ id: string }>> {
  await requireAdmin();
  const parsed = planSchema.safeParse(input);
  if (!parsed.success) return fromZodError(parsed.error);
  const v = parsed.data;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_save_plan", {
    p_id: v.id as string,
    p_name: v.name,
    p_duration_days: v.durationDays,
    p_price: v.price as number,
    p_currency: v.currency,
    p_is_active: v.isActive,
  });
  if (error || !data) {
    const res = fromDbError(error, "admin_save_plan");
    return !res.ok && res.code === "ERR_PLAN_DUPLICATE" ? { ...res, fieldErrors: { name: res.message } } : res;
  }
  revalidatePath("/parametres");
  return { ok: true, data: { id: data }, message: v.id ? "Formule mise à jour." : "Formule créée." };
}
