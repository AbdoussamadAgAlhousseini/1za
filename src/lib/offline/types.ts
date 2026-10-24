/** Instantané téléchargé pour le contrôle hors ligne (voir migration 0900). */
export interface OfflineSnapshot {
  version: 1;
  agent_id: string;
  generated_at: string;
  valid_until: string;
  today: string;
  timezone: string;
  salt: string;
  subscriptions: { h: string; s: string; e: string; st: "active" | "suspended"; p: string | null }[];
  inside: { h: string; at: string }[];
}

/** Opération enregistrée sans réseau, en attente de synchronisation. */
export interface QueuedOperation {
  id: string;
  agentId: string;
  kind: "entry" | "exit";
  matricule: string;
  occurredAt: string;
}

export type SyncResultCode = "applied" | "conflict" | "rejected";

export interface SyncResult {
  id: string;
  result: SyncResultCode;
  reason: string | null;
}

/** Opération synchronisée mais non appliquée : à signaler à l'administration. */
export interface SyncIssue extends QueuedOperation {
  result: Exclude<SyncResultCode, "applied">;
  reason: string | null;
  syncedAt: string;
}

export const SYNC_REASON_LABELS: Record<string, string> = {
  ALREADY_INSIDE: "Une entrée était déjà ouverte pour ce sportif.",
  SUBSCRIPTION_INVALID: "L'abonnement n'était pas valide à cette date.",
  NO_OPEN_VISIT: "Aucune entrée correspondante n'a été trouvée pour cette sortie.",
  ATHLETE_NOT_FOUND: "Matricule inconnu.",
  FUTURE_TIME: "Heure de l'appareil incorrecte (dans le futur).",
  TOO_OLD: "Opération trop ancienne (plus de 72 heures).",
  INVALID: "Opération invalide.",
  FORBIDDEN: "Opération appartenant à un autre compte.",
};
