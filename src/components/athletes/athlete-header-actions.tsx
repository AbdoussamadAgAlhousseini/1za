"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarPlus, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SubscriptionDialog, type RenewalSource } from "@/components/subscriptions/subscription-dialog";
import type { PlanOption } from "@/server/queries/common";

export function AthleteHeaderActions(props: {
  athleteId: string;
  matricule: string;
  renewal: RenewalSource | null;
  plans: PlanOption[];
  today: string;
  defaultCurrency: string;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<"new" | "renew" | null>(null);
  return (
    <div className="no-print flex flex-wrap gap-2">
      {props.renewal ? (
        <Button size="lg" onClick={() => setMode("renew")}>
          <RefreshCw />
          Renouveler
        </Button>
      ) : null}
      <Button size="lg" variant={props.renewal ? "secondary" : "primary"} onClick={() => setMode("new")}>
        <CalendarPlus />
        Nouvel abonnement
      </Button>
      <SubscriptionDialog
        open={mode !== null}
        onOpenChange={(o) => !o && setMode(null)}
        athleteId={props.athleteId}
        matricule={props.matricule}
        renewal={mode === "renew" ? props.renewal : null}
        plans={props.plans}
        today={props.today}
        defaultCurrency={props.defaultCurrency}
        onDone={() => router.refresh()}
      />
    </div>
  );
}
