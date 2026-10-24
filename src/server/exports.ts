import "server-only";
import type { ServerSupabaseClient } from "@/lib/supabase/server";
import { toCsv, type CsvColumn } from "@/lib/domain/csv";
import { VALIDITY_PRESENTATION, PAYMENT_METHOD_LABELS, VISIT_STATUS_PRESENTATION, type PaymentMethod } from "@/lib/domain/status";
import type { Period } from "@/lib/domain/periods";
import { formatDateTime } from "@/lib/domain/format";

export const EXPORT_KINDS = {
  athletes: "Sportifs et statut d'abonnement",
  subscriptions: "Abonnements (début dans la période)",
  visits: "Passages (entrées dans la période)",
  payments: "Paiements (dans la période)",
  attendance: "Fréquentation par jour",
  agents: "Activité des agents",
} as const;
export type ExportKind = keyof typeof EXPORT_KINDS;

/** Taille maximale d'un export (protection mémoire / exfiltration massive). */
const MAX_ROWS = 50_000;

function label(v: string | null | undefined) {
  return v ? (VALIDITY_PRESENTATION[v as keyof typeof VALIDITY_PRESENTATION]?.label ?? v) : "";
}

/**
 * Construit un export CSV. Les requêtes passent par la session de
 * l'administrateur (RLS) et ne contiennent que les champs nécessaires.
 */
export async function buildExport(supabase: ServerSupabaseClient, kind: ExportKind, period: Period, timezone: string): Promise<string> {
  switch (kind) {
    case "athletes": {
      const { data } = await supabase
        .from("athlete_overview")
        .select("matricule, registered_on, status, expiring_soon, plan_name, starts_on, ends_on, last_visit_at, visit_count")
        .order("matricule")
        .limit(MAX_ROWS);
      type R = NonNullable<typeof data>[number];
      const cols: CsvColumn<R>[] = [
        { header: "Matricule", value: (r) => r.matricule },
        { header: "Inscription", value: (r) => r.registered_on },
        { header: "Statut", value: (r) => (r.expiring_soon ? "Expire bientôt" : label(r.status)) },
        { header: "Formule", value: (r) => r.plan_name },
        { header: "Début abonnement", value: (r) => r.starts_on },
        { header: "Fin abonnement", value: (r) => r.ends_on },
        { header: "Dernière visite", value: (r) => (r.last_visit_at ? formatDateTime(r.last_visit_at, timezone) : "") },
        { header: "Nombre de visites", value: (r) => r.visit_count },
      ];
      return toCsv(data ?? [], cols);
    }
    case "subscriptions": {
      const { data } = await supabase
        .from("subscription_overview")
        .select("matricule, plan_name, starts_on, ends_on, length_days, validity, renewed_from_id, paid_amount, created_by_name, created_at")
        .gte("starts_on", period.from)
        .lte("starts_on", period.to)
        .order("starts_on")
        .limit(MAX_ROWS);
      type R = NonNullable<typeof data>[number];
      return toCsv(data ?? [], [
        { header: "Matricule", value: (r: R) => r.matricule },
        { header: "Formule", value: (r: R) => r.plan_name ?? "Personnalisée" },
        { header: "Début", value: (r: R) => r.starts_on },
        { header: "Fin (incluse)", value: (r: R) => r.ends_on },
        { header: "Durée (jours)", value: (r: R) => r.length_days },
        { header: "Statut", value: (r: R) => label(r.validity) },
        { header: "Renouvellement", value: (r: R) => (r.renewed_from_id ? "Oui" : "Non") },
        { header: "Montant payé", value: (r: R) => Number(r.paid_amount ?? 0) },
        { header: "Créé par", value: (r: R) => r.created_by_name },
      ]);
    }
    case "visits": {
      const { data } = await supabase
        .from("visit_log")
        .select("matricule, visit_date, entered_at, exited_at, status, duration_seconds, entry_agent_name, exit_agent_name, correction_reason")
        .gte("visit_date", period.from)
        .lte("visit_date", period.to)
        .order("entered_at")
        .limit(MAX_ROWS);
      type R = NonNullable<typeof data>[number];
      return toCsv(data ?? [], [
        { header: "Matricule", value: (r: R) => r.matricule },
        { header: "Date", value: (r: R) => r.visit_date },
        { header: "Entrée", value: (r: R) => formatDateTime(r.entered_at, timezone) },
        { header: "Sortie", value: (r: R) => (r.exited_at ? formatDateTime(r.exited_at, timezone) : "") },
        { header: "Durée (minutes)", value: (r: R) => (r.duration_seconds === null ? "" : Math.round(r.duration_seconds / 60)) },
        { header: "Statut", value: (r: R) => (r.status ? VISIT_STATUS_PRESENTATION[r.status].label : "") },
        { header: "Agent (entrée)", value: (r: R) => r.entry_agent_name },
        { header: "Agent (sortie)", value: (r: R) => r.exit_agent_name },
        { header: "Motif de correction", value: (r: R) => r.correction_reason },
      ]);
    }
    case "payments": {
      const { data } = await supabase
        .from("payment_log")
        .select("matricule, paid_on, amount, currency, method, reference, plan_name, status, recorded_by_name, cancel_reason")
        .gte("paid_on", period.from)
        .lte("paid_on", period.to)
        .order("paid_on")
        .limit(MAX_ROWS);
      type R = NonNullable<typeof data>[number];
      return toCsv(data ?? [], [
        { header: "Date", value: (r: R) => r.paid_on },
        { header: "Matricule", value: (r: R) => r.matricule },
        { header: "Montant", value: (r: R) => Number(r.amount) },
        { header: "Devise", value: (r: R) => r.currency },
        { header: "Mode", value: (r: R) => PAYMENT_METHOD_LABELS[(r.method ?? "other") as PaymentMethod] },
        { header: "Référence", value: (r: R) => r.reference },
        { header: "Formule", value: (r: R) => r.plan_name },
        { header: "Statut", value: (r: R) => (r.status === "cancelled" ? "Annulé" : "Enregistré") },
        { header: "Motif d'annulation", value: (r: R) => r.cancel_reason },
        { header: "Saisi par", value: (r: R) => r.recorded_by_name },
      ]);
    }
    case "attendance": {
      const { data } = await supabase.rpc("stats_attendance", { p_from: period.from, p_to: period.to, p_granularity: "day" });
      type R = NonNullable<typeof data>[number];
      return toCsv(data ?? [], [
        { header: "Jour", value: (r: R) => r.bucket },
        { header: "Entrées", value: (r: R) => r.entries },
        { header: "Sportifs uniques", value: (r: R) => r.unique_athletes },
        { header: "Visites terminées", value: (r: R) => r.completed },
        { header: "Durée moyenne (min)", value: (r: R) => (r.avg_duration_seconds === null ? "" : Math.round(r.avg_duration_seconds / 60)) },
      ]);
    }
    case "agents": {
      const { data } = await supabase.rpc("stats_agents", { p_from: period.from, p_to: period.to });
      type R = NonNullable<typeof data>[number];
      return toCsv(data ?? [], [
        { header: "Agent", value: (r: R) => r.display_name },
        { header: "Rôle", value: (r: R) => (r.role === "admin" ? "Administrateur" : "Agent") },
        { header: "Actif", value: (r: R) => (r.is_active ? "Oui" : "Non") },
        { header: "Entrées enregistrées", value: (r: R) => r.entries_recorded },
        { header: "Sorties enregistrées", value: (r: R) => r.exits_recorded },
        { header: "Dernière opération", value: (r: R) => (r.last_activity_at ? formatDateTime(r.last_activity_at, timezone) : "") },
      ]);
    }
  }
}
