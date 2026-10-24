"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { CloudOff, CheckCheck } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ReasonDialog } from "@/components/subscriptions/reason-dialog";
import { reviewOfflineOperation } from "@/server/actions/offline";
import { SYNC_REASON_LABELS } from "@/lib/offline/types";
import { formatDateTime } from "@/lib/domain/format";
import { formatMatricule } from "@/lib/domain/matricule";

export interface OfflineIssueRow {
  id: string;
  kind: string;
  occurred_at: string;
  received_at: string;
  result: string;
  reason_code: string | null;
  athlete_id: string | null;
  matricule: string | null;
  agent_name: string | null;
}

/** Opérations faites hors ligne que le serveur n'a pas pu appliquer. */
export function OfflineReview({ rows, timezone }: { rows: OfflineIssueRow[]; timezone: string }) {
  const router = useRouter();
  const [target, setTarget] = useState<OfflineIssueRow | null>(null);
  if (rows.length === 0) return null;
  return (
    <Card className="mb-6 border-warning-600/30">
      <CardHeader
        eyebrow="Mode hors ligne"
        title={
          <span className="flex items-center gap-2">
            <CloudOff className="size-4 text-warning-600" aria-hidden="true" />
            {rows.length} opération(s) hors ligne à vérifier
          </span>
        }
        description="Entrées ou sorties enregistrées sans réseau puis refusées par le serveur lors de la synchronisation. Vérifiez sur place, corrigez si besoin, puis marquez-les comme vérifiées."
      />
      <ul className="divide-y divide-line">
        {rows.map((r) => (
          <li key={r.id} className="flex flex-wrap items-center gap-x-4 gap-y-1.5 px-5 py-3 text-sm">
            <Badge tone={r.result === "rejected" ? "danger" : "warning"}>{r.kind === "entry" ? "Entrée" : "Sortie"}</Badge>
            {r.athlete_id ? (
              <Link href={`/sportifs/${r.athlete_id}`} className="font-display text-lg font-semibold tracking-[0.08em] text-ink hover:underline">
                {formatMatricule(r.matricule ?? "")}
              </Link>
            ) : (
              <span className="text-ink-muted">Matricule inconnu</span>
            )}
            <span className="text-ink-muted">
              {formatDateTime(r.occurred_at, timezone)} · {r.agent_name ?? "—"}
            </span>
            <span className="basis-full text-[13px] text-warning-700 sm:basis-auto">{SYNC_REASON_LABELS[r.reason_code ?? ""] ?? r.reason_code}</span>
            <Button variant="secondary" size="sm" className="ml-auto" onClick={() => setTarget(r)}>
              <CheckCheck />
              Marquer vérifiée
            </Button>
          </li>
        ))}
      </ul>
      {target ? (
        <ReasonDialog
          open
          onOpenChange={(o) => !o && setTarget(null)}
          title="Opération vérifiée"
          description="Indiquez ce qui a été constaté ou corrigé (ex. « sportif présent, abonnement renouvelé », « erreur de saisie »)."
          confirmLabel="Enregistrer"
          onSubmit={async (note) => {
            const res = await reviewOfflineOperation({ id: target.id, note });
            if (res.ok) router.refresh();
            return res;
          }}
        />
      ) : null}
    </Card>
  );
}
