"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/server/auth";
import { fromDbError, fromZodError } from "@/server/action-result";
import type { ActionResult } from "@/lib/action-types";
import { optionalIsoDate } from "@/lib/validation/common";
import { PAYMENT_METHODS } from "@/lib/domain/status";
import type { Database } from "@/lib/supabase/database.types";

const PAGE_SIZE = 25;

const searchSchema = z
  .string()
  .max(16)
  .default("")
  .transform((v) => v.normalize("NFD").replace(/\p{M}/gu, "").replace(/[^A-Za-z0-9]/g, "").toUpperCase().slice(0, 7));

export interface Paged<T> {
  rows: T[];
  total: number;
  page: number;
  pageSize: number;
}

// --- Abonnements -------------------------------------------------------------

const subscriptionListSchema = z.object({
  search: searchSchema,
  validity: z.enum(["all", "active", "expired", "upcoming", "suspended", "cancelled"]).default("all"),
  planId: z.union([z.uuid(), z.literal("")]).default(""),
  createdFrom: optionalIsoDate,
  createdTo: optionalIsoDate,
  page: z.number().int().min(1).max(100_000).default(1),
});
export type SubscriptionListInput = z.input<typeof subscriptionListSchema>;
export type SubscriptionRow = Database["public"]["Views"]["subscription_overview"]["Row"];

export async function listSubscriptions(input: SubscriptionListInput): Promise<ActionResult<Paged<SubscriptionRow>>> {
  await requireAdmin();
  const parsed = subscriptionListSchema.safeParse(input);
  if (!parsed.success) return fromZodError(parsed.error);
  const f = parsed.data;

  const supabase = await createClient();
  let q = supabase.from("subscription_overview").select("*", { count: "exact" });
  if (f.search) q = q.like("matricule", `${f.search}%`);
  if (f.validity !== "all") q = q.eq("validity", f.validity);
  if (f.planId) q = q.eq("plan_id", f.planId);
  if (f.createdFrom) q = q.gte("starts_on", f.createdFrom);
  if (f.createdTo) q = q.lte("starts_on", f.createdTo);
  const from = (f.page - 1) * PAGE_SIZE;
  const { data, count, error } = await q.order("created_at", { ascending: false }).range(from, from + PAGE_SIZE - 1);
  if (error) return fromDbError(error, "list_subscriptions");
  return { ok: true, data: { rows: data ?? [], total: count ?? 0, page: f.page, pageSize: PAGE_SIZE } };
}

// --- Paiements ---------------------------------------------------------------

const paymentListSchema = z.object({
  search: searchSchema,
  method: z.enum(["all", ...(PAYMENT_METHODS as [string, ...string[]])]).default("all"),
  status: z.enum(["all", "recorded", "cancelled"]).default("recorded"),
  from: optionalIsoDate,
  to: optionalIsoDate,
  page: z.number().int().min(1).max(100_000).default(1),
});
export type PaymentListInput = z.input<typeof paymentListSchema>;
export type PaymentRow = Database["public"]["Views"]["payment_log"]["Row"];

export async function listPayments(input: PaymentListInput): Promise<ActionResult<Paged<PaymentRow>>> {
  await requireAdmin();
  const parsed = paymentListSchema.safeParse(input);
  if (!parsed.success) return fromZodError(parsed.error);
  const f = parsed.data;

  const supabase = await createClient();
  let q = supabase.from("payment_log").select("*", { count: "exact" });
  if (f.search) q = q.like("matricule", `${f.search}%`);
  if (f.method !== "all") q = q.eq("method", f.method as Database["public"]["Enums"]["payment_method"]);
  if (f.status !== "all") q = q.eq("status", f.status);
  if (f.from) q = q.gte("paid_on", f.from);
  if (f.to) q = q.lte("paid_on", f.to);
  const from = (f.page - 1) * PAGE_SIZE;
  const { data, count, error } = await q
    .order("paid_on", { ascending: false })
    .order("created_at", { ascending: false })
    .range(from, from + PAGE_SIZE - 1);
  if (error) return fromDbError(error, "list_payments");
  return { ok: true, data: { rows: data ?? [], total: count ?? 0, page: f.page, pageSize: PAGE_SIZE } };
}

// --- Passages -----------------------------------------------------------------

const visitListSchema = z.object({
  search: searchSchema,
  athleteId: z.union([z.uuid(), z.literal("")]).default(""),
  status: z.enum(["all", "open", "closed", "cancelled"]).default("all"),
  agentId: z.union([z.uuid(), z.literal("")]).default(""),
  from: optionalIsoDate,
  to: optionalIsoDate,
  page: z.number().int().min(1).max(100_000).default(1),
});
export type VisitListInput = z.input<typeof visitListSchema>;
export type VisitRow = Database["public"]["Views"]["visit_log"]["Row"];

export async function listVisits(input: VisitListInput): Promise<ActionResult<Paged<VisitRow>>> {
  await requireAdmin();
  const parsed = visitListSchema.safeParse(input);
  if (!parsed.success) return fromZodError(parsed.error);
  const f = parsed.data;

  const supabase = await createClient();
  let q = supabase.from("visit_log").select("*", { count: "exact" });
  if (f.search) q = q.like("matricule", `${f.search}%`);
  if (f.athleteId) q = q.eq("athlete_id", f.athleteId);
  if (f.status !== "all") q = q.eq("status", f.status);
  if (f.agentId) q = q.or(`entry_agent_id.eq.${f.agentId},exit_agent_id.eq.${f.agentId}`);
  if (f.from) q = q.gte("visit_date", f.from);
  if (f.to) q = q.lte("visit_date", f.to);
  const from = (f.page - 1) * PAGE_SIZE;
  const { data, count, error } = await q.order("entered_at", { ascending: false }).range(from, from + PAGE_SIZE - 1);
  if (error) return fromDbError(error, "list_visits");
  return { ok: true, data: { rows: data ?? [], total: count ?? 0, page: f.page, pageSize: PAGE_SIZE } };
}

// --- Journal d'audit ----------------------------------------------------------

const auditListSchema = z.object({
  category: z.enum(["all", "athlete", "subscription", "payment", "visit", "profile", "settings", "export", "plan"]).default("all"),
  from: optionalIsoDate,
  to: optionalIsoDate,
  page: z.number().int().min(1).max(100_000).default(1),
});
export type AuditListInput = z.input<typeof auditListSchema>;
export type AuditRow = Database["public"]["Views"]["audit_log_view"]["Row"];

export async function listAudit(input: AuditListInput): Promise<ActionResult<Paged<AuditRow>>> {
  await requireAdmin();
  const parsed = auditListSchema.safeParse(input);
  if (!parsed.success) return fromZodError(parsed.error);
  const f = parsed.data;
  const supabase = await createClient();
  let q = supabase.from("audit_log_view").select("*", { count: "exact" });
  if (f.category !== "all") q = q.eq("entity_type", f.category);
  if (f.from) q = q.gte("occurred_at", `${f.from}T00:00:00Z`);
  if (f.to) q = q.lt("occurred_at", `${f.to}T23:59:59.999Z`);
  const from = (f.page - 1) * PAGE_SIZE;
  const { data, count, error } = await q.order("occurred_at", { ascending: false }).range(from, from + PAGE_SIZE - 1);
  if (error) return fromDbError(error, "list_audit");
  return { ok: true, data: { rows: data ?? [], total: count ?? 0, page: f.page, pageSize: PAGE_SIZE } };
}
