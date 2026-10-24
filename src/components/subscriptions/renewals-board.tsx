"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, CheckCircle2, RefreshCw, XCircle } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/states";
import { SubscriptionDialog } from "@/components/subscriptions/subscription-dialog";
import { formatDate, formatRelativeDays } from "@/lib/domain/format";
import { formatMatricule } from "@/lib/domain/matricule";
import type { PlanOption } from "@/server/queries/common";
import { cn } from "@/lib/cn";

export interface RenewalRow {
  id: string;
  matricule: string;
  subscription_id: string;
  plan_id: string | null;
  plan_name: string | null;
  ends_on: string;
  days_remaining: number;
}

export function RenewalsBoard({
  expiring,
  expired,
  plans,
  today,
  defaultCurrency,
  expiringDays,
}: {
  expiring: RenewalRow[];
  expired: RenewalRow[];
  plans: PlanOption[];
  today: string;
  defaultCurrency: string;
  expiringDays: number;
}) {
  const router = useRouter();
  const [target, setTarget] = useState<RenewalRow | null>(null);

  const section = (title: string, description: string, rows: RenewalRow[], tone: "warning" | "danger") => (
    <Card>
      <CardHeader
        eyebrow={tone === "warning" ? "À anticiper" : "À relancer"}
        title={`${title} · ${rows.length}`}
        description={description}
      />
      {rows.length ? (
        <ul className="divide-y divide-line">
          {rows.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3">
              <span
                className={cn(
                  "grid size-9 shrink-0 place-items-center rounded-full",
                  tone === "warning" ? "bg-warning-50 text-warning-700" : "bg-danger-50 text-danger-700",
                )}
              >
                {tone === "warning" ? <AlertTriangle className="size-4" aria-hidden="true" /> : <XCircle className="size-4" aria-hidden="true" />}
              </span>
              <Link href={`/sportifs/${r.id}`} className="min-w-28 hover:underline">
                <span className="block font-display text-xl font-semibold tracking-[0.08em] text-ink">{formatMatricule(r.matricule)}</span>
                <span className="block text-xs text-ink-muted">{r.plan_name ?? "Formule personnalisée"}</span>
              </Link>
              <span className="text-[13px]">
                <span className={cn("block font-semibold", tone === "warning" ? "text-warning-700" : "text-danger-700")}>
                  {tone === "warning" ? `Fin ${formatRelativeDays(r.days_remaining)}` : `Expiré ${formatRelativeDays(r.days_remaining)}`}
                </span>
                <span className="block text-xs text-ink-muted">{formatDate(r.ends_on)}</span>
              </span>
              <Button variant="secondary" size="sm" className="ml-auto" onClick={() => setTarget(r)}>
                <RefreshCw />
                Renouveler
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState compact icon={<CheckCircle2 />} title="Rien à signaler" description={tone === "warning" ? "Aucun abonnement ne se termine prochainement." : "Aucun abonnement expiré sans renouvellement."} />
      )}
    </Card>
  );

  return (
    <>
      <div className="grid items-start gap-6 xl:grid-cols-2">
        {section("Expirent bientôt", `Fin dans moins de ${expiringDays} jours, sans renouvellement prévu.`, expiring, "warning")}
        {section("Expirés sans renouvellement", "Terminés au cours des 60 derniers jours.", expired, "danger")}
      </div>
      {target ? (
        <SubscriptionDialog
          open
          onOpenChange={(o) => !o && setTarget(null)}
          athleteId={target.id}
          matricule={target.matricule}
          renewal={{ id: target.subscription_id, endsOn: target.ends_on, planId: target.plan_id }}
          plans={plans}
          today={today}
          defaultCurrency={defaultCurrency}
          onDone={() => router.refresh()}
        />
      ) : null}
    </>
  );
}
