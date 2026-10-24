"use client";

import { AlertTriangle, CloudOff, CloudUpload, RefreshCw, Wifi } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { formatDateTime, formatTime } from "@/lib/domain/format";
import { formatMatricule } from "@/lib/domain/matricule";
import { SYNC_REASON_LABELS, type OfflineSnapshot, type QueuedOperation, type SyncIssue } from "@/lib/offline/types";
import { cn } from "@/lib/cn";

/** Indicateur de connexion et de disponibilité du mode hors ligne. */
export function OfflineStatus({
  online,
  snapshot,
  pending,
  syncing,
  timezone,
}: {
  online: boolean;
  snapshot: OfflineSnapshot | null;
  pending: number;
  syncing: boolean;
  timezone: string;
}) {
  return (
    <div
      role="status"
      className={cn(
        "flex items-center gap-2.5 rounded-lg border px-3.5 py-2 text-[13px] shadow-card",
        online ? "border-line bg-surface text-ink-soft" : "border-warning-600/30 bg-warning-50 text-warning-700",
      )}
    >
      {online ? <Wifi className="size-4 text-success-600" aria-hidden="true" /> : <CloudOff className="size-4" aria-hidden="true" />}
      <div className="leading-tight">
        <p className="font-semibold">{online ? "En ligne" : "Hors ligne"}</p>
        <p className="text-xs opacity-80">
          {syncing
            ? "Synchronisation…"
            : pending > 0
              ? `${pending} opération(s) à transmettre`
              : snapshot
                ? `Hors ligne prêt · données de ${formatTime(snapshot.generated_at, timezone)}`
                : "Données hors ligne non téléchargées"}
        </p>
      </div>
    </div>
  );
}

/** File d'attente et incidents de synchronisation. Masqué quand tout est à jour. */
export function OfflineSyncPanel({
  online,
  queue,
  issues,
  syncing,
  timezone,
  onSync,
  onDismissIssues,
}: {
  online: boolean;
  queue: QueuedOperation[];
  issues: SyncIssue[];
  syncing: boolean;
  timezone: string;
  onSync: () => void;
  onDismissIssues: () => void;
}) {
  if (queue.length === 0 && issues.length === 0) return null;
  return (
    <>
      {queue.length > 0 ? (
        <Card className="border-warning-600/30">
          <CardHeader
            title={
              <span className="flex items-center gap-2">
                <CloudUpload className="size-4 text-warning-600" aria-hidden="true" />
                {queue.length} opération(s) en attente
              </span>
            }
            description={online ? "Transmission automatique en cours." : "Enregistrées sur ce téléphone, transmises dès le retour du réseau."}
            action={
              <Button variant="secondary" size="sm" onClick={onSync} loading={syncing} disabled={!online}>
                {syncing ? null : <RefreshCw />}
                Envoyer
              </Button>
            }
          />
          <ul className="max-h-60 divide-y divide-line overflow-y-auto">
            {[...queue]
              .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))
              .map((op) => (
                <li key={op.id} className="flex items-center gap-3 px-5 py-2 text-sm">
                  <span className="font-semibold tracking-[0.04em] text-ink">{formatMatricule(op.matricule)}</span>
                  <span className="text-ink-muted">{op.kind === "entry" ? "Entrée" : "Sortie"}</span>
                  <span className="tabular ml-auto text-ink-muted">{formatTime(op.occurredAt, timezone)}</span>
                </li>
              ))}
          </ul>
        </Card>
      ) : null}
      {issues.length > 0 ? (
        <Card className="border-danger-600/30">
          <CardHeader
            title={
              <span className="flex items-center gap-2">
                <AlertTriangle className="size-4 text-danger-600" aria-hidden="true" />
                {issues.length} opération(s) non appliquée(s)
              </span>
            }
            description="Transmises à l'administration pour vérification. Signalez-les au responsable."
            action={
              <Button variant="ghost" size="sm" onClick={onDismissIssues}>
                J&apos;ai signalé
              </Button>
            }
          />
          <ul className="max-h-60 divide-y divide-line overflow-y-auto">
            {issues.map((op) => (
              <li key={op.id} className="px-5 py-2.5 text-sm">
                <p>
                  <span className="font-semibold tracking-[0.04em] text-ink">{formatMatricule(op.matricule)}</span>{" "}
                  <span className="text-ink-muted">
                    · {op.kind === "entry" ? "Entrée" : "Sortie"} du {formatDateTime(op.occurredAt, timezone)}
                  </span>
                </p>
                <p className="text-[13px] text-danger-700">{SYNC_REASON_LABELS[op.reason ?? ""] ?? "Opération refusée."}</p>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
    </>
  );
}
