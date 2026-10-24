"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/server/auth";
import { fromDbError, fromZodError } from "@/server/action-result";
import type { ActionResult } from "@/lib/action-types";
import {
  cancelPaymentSchema,
  createSubscriptionSchema,
  recordPaymentSchema,
  subscriptionStateSchema,
} from "@/lib/validation/subscriptions";
import type { PaymentMethod } from "@/lib/domain/status";

function revalidateAll(athleteId?: string) {
  revalidatePath("/abonnements");
  revalidatePath("/sportifs");
  revalidatePath("/paiements");
  revalidatePath("/tableau-de-bord");
  if (athleteId) revalidatePath(`/sportifs/${athleteId}`);
}

export interface CreateSubscriptionInput {
  athleteId: string;
  renewedFromId: string | null;
  subscription: {
    planId: string | null;
    startsOn: string;
    endsOn: string;
    withPayment: boolean;
    payment?: { amount: number | string; currency: string; method: string; reference?: string; paidOn: string };
  };
}

export async function createSubscription(input: CreateSubscriptionInput): Promise<ActionResult<{ subscriptionId: string }>> {
  await requireAdmin();
  const parsed = createSubscriptionSchema.safeParse(input);
  if (!parsed.success) return fromZodError(parsed.error);
  const { athleteId, renewedFromId, subscription: s } = parsed.data;
  const pay = s.withPayment ? s.payment : undefined;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_create_subscription", {
    p_athlete_id: athleteId,
    p_plan_id: s.planId as string,
    p_starts_on: s.startsOn,
    p_ends_on: s.endsOn,
    ...(renewedFromId ? { p_renewed_from_id: renewedFromId } : {}),
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
  if (error || !data) {
    const res = fromDbError(error, "admin_create_subscription");
    if (!res.ok && res.code === "ERR_SUBSCRIPTION_OVERLAP") return { ...res, fieldErrors: { "subscription.startsOn": res.message } };
    return res;
  }

  revalidateAll(athleteId);
  return { ok: true, data: { subscriptionId: data }, message: renewedFromId ? "Abonnement renouvelé." : "Abonnement créé." };
}

export async function setSubscriptionState(input: { subscriptionId: string; state: string; reason: string }): Promise<ActionResult> {
  await requireAdmin();
  const parsed = subscriptionStateSchema.safeParse(input);
  if (!parsed.success) return fromZodError(parsed.error);

  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_set_subscription_state", {
    p_subscription_id: parsed.data.subscriptionId,
    p_state: parsed.data.state,
    p_reason: parsed.data.reason,
  });
  if (error) return fromDbError(error, "admin_set_subscription_state");

  revalidateAll();
  const labels = { active: "Abonnement réactivé.", suspended: "Abonnement suspendu.", cancelled: "Abonnement annulé." };
  return { ok: true, data: undefined, message: labels[parsed.data.state] };
}

export async function recordPayment(input: {
  athleteId: string;
  subscriptionId: string | null;
  payment: { amount: number | string; currency: string; method: string; reference?: string; paidOn: string };
}): Promise<ActionResult> {
  await requireAdmin();
  const parsed = recordPaymentSchema.safeParse(input);
  if (!parsed.success) return fromZodError(parsed.error);
  const { athleteId, subscriptionId, payment } = parsed.data;

  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_record_payment", {
    p_athlete_id: athleteId,
    p_subscription_id: subscriptionId as string,
    p_amount: payment.amount,
    p_currency: payment.currency,
    p_paid_on: payment.paidOn,
    p_method: payment.method as PaymentMethod,
    p_reference: payment.reference || undefined,
  });
  if (error) return fromDbError(error, "admin_record_payment");

  revalidateAll(athleteId);
  return { ok: true, data: undefined, message: "Paiement enregistré." };
}

export async function cancelPayment(input: { paymentId: string; reason: string }): Promise<ActionResult> {
  await requireAdmin();
  const parsed = cancelPaymentSchema.safeParse(input);
  if (!parsed.success) return fromZodError(parsed.error);

  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_cancel_payment", { p_payment_id: parsed.data.paymentId, p_reason: parsed.data.reason });
  if (error) return fromDbError(error, "admin_cancel_payment");

  revalidateAll();
  return { ok: true, data: undefined, message: "Paiement annulé." };
}
