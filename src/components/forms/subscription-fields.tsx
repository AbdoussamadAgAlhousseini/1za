"use client";

import { useMemo } from "react";
import { CalendarRange, Wallet } from "lucide-react";
import { Field, Input, Select } from "@/components/ui/field";
import { computeEndDate, daysBetween } from "@/lib/domain/periods";
import { formatDate, formatMoney } from "@/lib/domain/format";
import { PAYMENT_METHOD_LABELS, PAYMENT_METHODS } from "@/lib/domain/status";
import type { PlanOption } from "@/server/queries/common";
import { cn } from "@/lib/cn";

export interface SubscriptionDraft {
  planId: string;
  startsOn: string;
  endsOn: string;
  endsOnEdited: boolean;
  withPayment: boolean;
  amount: string;
  currency: string;
  method: string;
  reference: string;
  paidOn: string;
}

export function initialSubscriptionDraft(opts: {
  plans: PlanOption[];
  startsOn: string;
  today: string;
  defaultCurrency: string;
}): SubscriptionDraft {
  const plan = opts.plans.find((p) => p.is_active);
  return {
    planId: plan?.id ?? "",
    startsOn: opts.startsOn,
    endsOn: plan ? computeEndDate(opts.startsOn, plan.duration_days) : opts.startsOn,
    endsOnEdited: false,
    withPayment: Boolean(plan?.price),
    amount: plan?.price ? String(plan.price) : "",
    currency: plan?.currency ?? opts.defaultCurrency,
    method: "cash",
    reference: "",
    paidOn: opts.today,
  };
}

export function draftToInput(d: SubscriptionDraft) {
  return {
    planId: d.planId || null,
    startsOn: d.startsOn,
    endsOn: d.endsOn,
    withPayment: d.withPayment,
    payment: d.withPayment
      ? { amount: d.amount.replace(",", "."), currency: d.currency, method: d.method, reference: d.reference || undefined, paidOn: d.paidOn }
      : undefined,
  };
}

export function SubscriptionFields({
  draft,
  onChange,
  plans,
  errors,
  prefix = "subscription.",
}: {
  draft: SubscriptionDraft;
  onChange: (d: SubscriptionDraft) => void;
  plans: PlanOption[];
  errors?: Record<string, string>;
  prefix?: string;
}) {
  const activePlans = plans.filter((p) => p.is_active);
  const err = (k: string) => errors?.[`${prefix}${k}`];
  const length = useMemo(() => {
    const n = daysBetween(draft.startsOn, draft.endsOn) + 1;
    return Number.isFinite(n) ? n : null;
  }, [draft.startsOn, draft.endsOn]);

  const set = (patch: Partial<SubscriptionDraft>) => onChange({ ...draft, ...patch });

  const selectPlan = (planId: string) => {
    const plan = plans.find((p) => p.id === planId);
    set({
      planId,
      endsOn: plan && !draft.endsOnEdited ? computeEndDate(draft.startsOn, plan.duration_days) : draft.endsOn,
      amount: plan?.price ? String(plan.price) : draft.amount,
      currency: plan?.currency ?? draft.currency,
      withPayment: plan?.price ? true : draft.withPayment,
    });
  };

  const changeStart = (startsOn: string) => {
    const plan = plans.find((p) => p.id === draft.planId);
    set({ startsOn, endsOn: plan && !draft.endsOnEdited && startsOn ? computeEndDate(startsOn, plan.duration_days) : draft.endsOn });
  };

  return (
    <div className="space-y-4">
      <Field label="Formule" error={err("planId")} hint={activePlans.length === 0 ? "Aucune formule configurée : définissez les dates manuellement ou créez des formules dans Paramètres." : undefined}>
        {(p) => (
          <Select {...p} value={draft.planId} onChange={(e) => selectPlan(e.target.value)}>
            {activePlans.map((plan) => (
              <option key={plan.id} value={plan.id}>
                {plan.name} — {plan.duration_days} jour{plan.duration_days > 1 ? "s" : ""}
                {plan.price !== null ? ` — ${formatMoney(plan.price, plan.currency)}` : ""}
              </option>
            ))}
            <option value="">Personnalisée (dates libres)</option>
          </Select>
        )}
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Date de début" error={err("startsOn")}>
          {(p) => <Input {...p} type="date" required value={draft.startsOn} onChange={(e) => changeStart(e.target.value)} />}
        </Field>
        <Field label="Date de fin (incluse)" error={err("endsOn")}>
          {(p) => (
            <Input {...p} type="date" required min={draft.startsOn} value={draft.endsOn} onChange={(e) => set({ endsOn: e.target.value, endsOnEdited: true })} />
          )}
        </Field>
      </div>

      <div className="flex items-start gap-3 rounded-md border border-pitch-200 bg-pitch-50 px-3.5 py-3 text-[13px] text-pitch-800">
        <CalendarRange className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        <p>
          {length && length > 0 ? (
            <>
              <strong className="font-semibold">{length} jour{length > 1 ? "s" : ""}</strong> de validité, du {formatDate(draft.startsOn)} au{" "}
              {formatDate(draft.endsOn)} inclus (jusqu&apos;à 23 h 59, heure du stade).
            </>
          ) : (
            "Vérifiez les dates : la fin doit être postérieure ou égale au début."
          )}
        </p>
      </div>

      <div className="rounded-lg border border-line">
        <label className="flex cursor-pointer items-center gap-3 px-4 py-3">
          <input
            type="checkbox"
            className="size-4 accent-pitch-700"
            checked={draft.withPayment}
            onChange={(e) => set({ withPayment: e.target.checked })}
          />
          <span className="flex items-center gap-2 text-sm font-semibold text-ink">
            <Wallet className="size-4 text-ink-muted" aria-hidden="true" />
            Enregistrer le paiement reçu
          </span>
        </label>
        <div className={cn("grid gap-4 border-t border-line px-4 py-4 sm:grid-cols-2", !draft.withPayment && "hidden")}>
          <Field label="Montant" error={err("payment.amount")}>
            {(p) => <Input {...p} inputMode="decimal" value={draft.amount} onChange={(e) => set({ amount: e.target.value })} />}
          </Field>
          <Field label="Devise" error={err("payment.currency")}>
            {(p) => <Input {...p} maxLength={3} value={draft.currency} onChange={(e) => set({ currency: e.target.value.toUpperCase() })} />}
          </Field>
          <Field label="Mode de paiement" error={err("payment.method")}>
            {(p) => (
              <Select {...p} value={draft.method} onChange={(e) => set({ method: e.target.value })}>
                {PAYMENT_METHODS.map((m) => (
                  <option key={m} value={m}>
                    {PAYMENT_METHOD_LABELS[m]}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Date du paiement" error={err("payment.paidOn")}>
            {(p) => <Input {...p} type="date" value={draft.paidOn} onChange={(e) => set({ paidOn: e.target.value })} />}
          </Field>
          <Field label="Référence de transaction" optional className="sm:col-span-2" error={err("payment.reference")} hint="Numéro de reçu ou de transaction mobile money, si disponible.">
            {(p) => <Input {...p} maxLength={80} value={draft.reference} onChange={(e) => set({ reference: e.target.value })} />}
          </Field>
        </div>
      </div>
    </div>
  );
}
