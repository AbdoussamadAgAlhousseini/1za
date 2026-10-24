"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { AlertCircle, CalendarPlus, RefreshCw } from "lucide-react";
import { Dialog, DialogContent, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { InlineAlert } from "@/components/ui/states";
import { SubscriptionFields, draftToInput, initialSubscriptionDraft, type SubscriptionDraft } from "@/components/forms/subscription-fields";
import { createSubscription } from "@/server/actions/subscriptions";
import { safeAction } from "@/lib/safe-action";
import { formatDate } from "@/lib/domain/format";
import { formatMatricule } from "@/lib/domain/matricule";
import { suggestRenewalStart } from "@/lib/domain/periods";
import type { PlanOption } from "@/server/queries/common";

export interface RenewalSource {
  id: string;
  endsOn: string;
  planId: string | null;
}

/** Création d'un abonnement ou renouvellement (l'ancien est conservé dans l'historique). */
export function SubscriptionDialog({
  open,
  onOpenChange,
  athleteId,
  matricule,
  renewal,
  plans,
  today,
  defaultCurrency,
  onDone,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  athleteId: string;
  matricule: string;
  renewal: RenewalSource | null;
  plans: PlanOption[];
  today: string;
  defaultCurrency: string;
  onDone?: () => void;
}) {
  const makeDraft = (): SubscriptionDraft => {
    const start = suggestRenewalStart(renewal?.endsOn ?? null, today);
    const draft = initialSubscriptionDraft({ plans, startsOn: start, today, defaultCurrency });
    const previousPlan = renewal?.planId ? plans.find((p) => p.id === renewal.planId && p.is_active) : undefined;
    if (!previousPlan) return draft;
    return {
      ...draft,
      planId: previousPlan.id,
      endsOn: new Date(Date.parse(`${start}T12:00:00Z`) + (previousPlan.duration_days - 1) * 86_400_000).toISOString().slice(0, 10),
      amount: previousPlan.price ? String(previousPlan.price) : draft.amount,
      currency: previousPlan.currency,
      withPayment: Boolean(previousPlan.price),
    };
  };
  const [draft, setDraft] = useState<SubscriptionDraft>(makeDraft);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const submit = () => {
    startTransition(async () => {
      const res = await safeAction(() => createSubscription({ athleteId, renewedFromId: renewal?.id ?? null, subscription: draftToInput(draft) }));
      if (!res.ok) {
        setErrors(res.fieldErrors ?? {});
        setFormError(res.message);
        return;
      }
      toast.success(res.message ?? "Abonnement enregistré.");
      onOpenChange(false);
      onDone?.();
    });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (o) {
          setDraft(makeDraft());
          setErrors({});
          setFormError(null);
        }
      }}
    >
      <DialogContent
        size="lg"
        title={renewal ? "Renouveler l'abonnement" : "Nouvel abonnement"}
        description={
          <>
            Sportif <strong className="font-semibold text-ink">{formatMatricule(matricule)}</strong>
            {renewal ? <> · l&apos;abonnement actuel se termine le {formatDate(renewal.endsOn)} et reste dans l&apos;historique.</> : null}
          </>
        }
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
          className="space-y-5"
          noValidate
        >
          {formError ? (
            <InlineAlert tone="danger" icon={<AlertCircle />}>
              {formError}
            </InlineAlert>
          ) : null}
          <SubscriptionFields draft={draft} onChange={setDraft} plans={plans} errors={errors} />
          <DialogFooter>
            <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={pending}>
              Annuler
            </Button>
            <Button type="submit" loading={pending}>
              {pending ? null : renewal ? <RefreshCw /> : <CalendarPlus />}
              {renewal ? "Renouveler" : "Créer l'abonnement"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
