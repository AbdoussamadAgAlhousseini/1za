"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/server/auth";
import { fail, fromDbError, fromZodError } from "@/server/action-result";
import type { ActionResult } from "@/lib/action-types";
import { athleteListSchema, PAGE_SIZE, registerAthleteSchema, type AthleteListInput } from "@/lib/validation/athletes";
import type { PaymentMethod } from "@/lib/domain/status";
import type { Database } from "@/lib/supabase/database.types";

export type AthleteRow = Pick<
  Database["public"]["Views"]["athlete_overview"]["Row"],
  | "id"
  | "matricule"
  | "registered_on"
  | "status"
  | "expiring_soon"
  | "starts_on"
  | "ends_on"
  | "days_remaining"
  | "plan_name"
  | "last_visit_at"
  | "visit_count"
>;

export interface AthleteListResult {
  rows: AthleteRow[];
  total: number;
  page: number;
  pageSize: number;
}

const SORTS = {
  registered_desc: { column: "registered_on", ascending: false },
  registered_asc: { column: "registered_on", ascending: true },
  matricule_asc: { column: "matricule", ascending: true },
  last_visit_desc: { column: "last_visit_at", ascending: false },
  ends_on_asc: { column: "ends_on", ascending: true },
} as const;

export async function listAthletes(input: AthleteListInput): Promise<ActionResult<AthleteListResult>> {
  await requireAdmin();
  const parsed = athleteListSchema.safeParse(input);
  if (!parsed.success) return fromZodError(parsed.error);
  const f = parsed.data;

  const supabase = await createClient();
  let query = supabase
    .from("athlete_overview")
    .select("id, matricule, registered_on, status, expiring_soon, starts_on, ends_on, days_remaining, plan_name, last_visit_at, visit_count", {
      count: "exact",
    });

  if (f.search) query = query.like("matricule", `${f.search}%`);
  if (f.status === "expiring") query = query.eq("expiring_soon", true);
  else if (f.status !== "all") query = query.eq("status", f.status);
  if (f.registeredFrom) query = query.gte("registered_on", f.registeredFrom);
  if (f.registeredTo) query = query.lte("registered_on", f.registeredTo);

  const sort = SORTS[f.sort];
  query = query.order(sort.column, { ascending: sort.ascending, nullsFirst: false }).order("matricule", { ascending: true });

  const from = (f.page - 1) * PAGE_SIZE;
  const { data, count, error } = await query.range(from, from + PAGE_SIZE - 1);
  if (error) return fromDbError(error, "list_athletes");

  return { ok: true, data: { rows: data ?? [], total: count ?? 0, page: f.page, pageSize: PAGE_SIZE } };
}

export interface RegisterAthleteInput {
  matricule: string;
  registeredOn: string;
  withSubscription: boolean;
  subscription?: {
    planId: string | null;
    startsOn: string;
    endsOn: string;
    withPayment: boolean;
    payment?: { amount: number | string; currency: string; method: string; reference?: string; paidOn: string };
  };
}

export async function registerAthlete(input: RegisterAthleteInput): Promise<ActionResult<{ athleteId: string; warning?: string }>> {
  await requireAdmin();
  const parsed = registerAthleteSchema.safeParse(input);
  if (!parsed.success) return fromZodError(parsed.error);
  const v = parsed.data;

  const supabase = await createClient();
  const { data: athleteId, error } = await supabase.rpc("admin_create_athlete", {
    p_matricule: v.matricule,
    p_registered_on: v.registeredOn,
  });
  if (error || !athleteId) {
    const result = fromDbError(error, "admin_create_athlete");
    if (!result.ok && result.code === "ERR_MATRICULE_DUPLICATE") return { ...result, fieldErrors: { matricule: result.message } };
    if (!result.ok && result.code === "ERR_MATRICULE_FORMAT") return { ...result, fieldErrors: { matricule: result.message } };
    return result;
  }

  revalidatePath("/sportifs");
  revalidatePath("/tableau-de-bord");

  if (v.withSubscription && v.subscription) {
    const s = v.subscription;
    const pay = s.withPayment ? s.payment : undefined;
    const { error: subError } = await supabase.rpc("admin_create_subscription", {
      p_athlete_id: athleteId,
      p_plan_id: s.planId as string,
      p_starts_on: s.startsOn,
      p_ends_on: s.endsOn,
      ...(pay
        ? {
            p_payment_amount: pay.amount,
            p_payment_currency: pay.currency,
            p_payment_method: pay.method as PaymentMethod,
            p_payment_reference: pay.reference || undefined,
            p_paid_on: pay.paidOn,
          }
        : {}),
    });
    if (subError) {
      const sub = fromDbError(subError, "admin_create_subscription");
      return {
        ok: true,
        data: {
          athleteId,
          warning: `Sportif enregistré, mais l'abonnement n'a pas pu être créé : ${sub.ok ? "" : sub.message}`,
        },
      };
    }
  }

  return { ok: true, data: { athleteId }, message: "Sportif enregistré." };
}

export async function checkMatriculeAvailability(raw: string): Promise<ActionResult<{ available: boolean; athleteId?: string }>> {
  await requireAdmin();
  const parsed = registerAthleteSchema.shape.matricule.safeParse(raw);
  if (!parsed.success) return fail("Format invalide.");
  const supabase = await createClient();
  const { data } = await supabase.from("athletes").select("id").eq("matricule", parsed.data).maybeSingle();
  return { ok: true, data: { available: !data, athleteId: data?.id } };
}
