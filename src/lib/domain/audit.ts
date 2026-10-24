import type { Tone } from "./status";
import { formatDate } from "./format";

/** Libellés français des actions journalisées. */
export const AUDIT_ACTIONS: Record<string, { label: string; tone: Tone }> = {
  "athlete.created": { label: "Sportif enregistré", tone: "success" },
  "athlete.deleted": { label: "Sportif supprimé", tone: "danger" },
  "staff.deleted": { label: "Compte d'agent supprimé", tone: "danger" },
  "subscription.created": { label: "Abonnement créé", tone: "success" },
  "subscription.renewed": { label: "Abonnement renouvelé", tone: "success" },
  "subscription.state_changed": { label: "État d'abonnement modifié", tone: "warning" },
  "payment.recorded": { label: "Paiement enregistré", tone: "success" },
  "payment.cancelled": { label: "Paiement annulé", tone: "danger" },
  "visit.corrected": { label: "Passage corrigé", tone: "warning" },
  "staff.created": { label: "Agent créé", tone: "info" },
  "staff.renamed": { label: "Agent renommé", tone: "info" },
  "staff.activated": { label: "Accès rétabli", tone: "info" },
  "staff.deactivated": { label: "Accès révoqué", tone: "danger" },
  "staff.password_reset": { label: "Mot de passe d'agent réinitialisé", tone: "warning" },
  "staff.password_changed": { label: "Mot de passe modifié par l'utilisateur", tone: "neutral" },
  "staff.password_recovered": { label: "Mot de passe administrateur récupéré", tone: "warning" },
  "staff.bootstrap_admin": { label: "Compte administrateur initialisé", tone: "info" },
  "plan.created": { label: "Formule créée", tone: "info" },
  "plan.updated": { label: "Formule modifiée", tone: "info" },
  "settings.updated": { label: "Paramètres modifiés", tone: "warning" },
  "export.generated": { label: "Export de données", tone: "neutral" },
  "offline.synced": { label: "Synchronisation hors ligne", tone: "info" },
  "offline.reviewed": { label: "Opération hors ligne vérifiée", tone: "neutral" },
};

const STATE_LABELS: Record<string, string> = { active: "actif", suspended: "suspendu", cancelled: "annulé" };

/** Résumé lisible des détails d'une entrée (jamais de donnée personnelle de sportif). */
export function describeAuditDetails(action: string, details: Record<string, unknown> | null): string {
  if (!details) return "";
  const d = details;
  const s = (k: string) => (d[k] === null || d[k] === undefined ? "" : String(d[k]));
  switch (action) {
    case "subscription.created":
    case "subscription.renewed":
      return `Du ${formatDate(s("starts_on"))} au ${formatDate(s("ends_on"))}${d.payment_id ? " · avec paiement" : ""}`;
    case "subscription.state_changed":
      return `${STATE_LABELS[s("from")] ?? s("from")} → ${STATE_LABELS[s("to")] ?? s("to")} · motif : ${s("reason")}`;
    case "payment.recorded":
      return `${s("amount")} ${s("currency")}`;
    case "athlete.deleted":
      return `Motif : ${s("reason")} · ${s("subscriptions")} abonnement(s), ${s("payments")} paiement(s), ${s("visits")} passage(s) effacés`;
    case "staff.deleted":
      return `Motif : ${s("reason")}`;
    case "payment.cancelled":
      return `Motif : ${s("reason")}`;
    case "visit.corrected":
      return `${s("action") === "cancel" ? "Annulation" : "Sortie corrigée"} · motif : ${s("reason")}`;
    case "staff.renamed":
      return `Nouveau nom : ${s("display_name")}`;
    case "plan.created":
    case "plan.updated":
      return `${s("name")} · ${s("duration_days")} j`;
    case "export.generated": {
      const params = (d.params ?? {}) as Record<string, unknown>;
      return `${s("kind")} · du ${formatDate(String(params.from ?? ""))} au ${formatDate(String(params.to ?? ""))}`;
    }
    case "offline.synced":
      return `${s("applied")} appliquée(s) · ${s("to_review")} à vérifier`;
    case "offline.reviewed":
      return `Note : ${s("note")}`;
    case "settings.updated":
      return "Voir le détail avant / après";
    default:
      return "";
  }
}
