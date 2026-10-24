"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import * as Dropdown from "@radix-ui/react-dropdown-menu";
import { Ban, CalendarX2, MoreHorizontal, PauseCircle, PlayCircle, Wallet, Receipt, XCircle } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge, ValidityBadge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/states";
import { ReasonDialog } from "@/components/subscriptions/reason-dialog";
import { PaymentDialog, type PaymentTarget } from "@/components/subscriptions/payment-dialog";
import { cancelPayment, setSubscriptionState } from "@/server/actions/subscriptions";
import { formatDate, formatMoney, pluralize } from "@/lib/domain/format";
import { formatMatricule } from "@/lib/domain/matricule";
import { PAYMENT_METHOD_LABELS, type PaymentMethod, type SubscriptionValidity } from "@/lib/domain/status";
import type { AthleteDetail } from "@/server/queries/athletes";
import { cn } from "@/lib/cn";

type Sub = AthleteDetail["subscriptions"][number];
type Pay = AthleteDetail["payments"][number];

type StateAction = { sub: Sub; to: "active" | "suspended" | "cancelled" } | null;

const STATE_COPY = {
  suspended: { title: "Suspendre l'abonnement", confirm: "Suspendre", tone: "danger" as const, text: "Le sportif ne pourra plus entrer tant que l'abonnement est suspendu." },
  active: { title: "Réactiver l'abonnement", confirm: "Réactiver", tone: "primary" as const, text: "L'abonnement redeviendra valide selon ses dates." },
  cancelled: { title: "Annuler l'abonnement", confirm: "Annuler définitivement", tone: "danger" as const, text: "L'annulation est définitive. L'abonnement reste visible dans l'historique mais n'ouvre plus aucun droit." },
};

export function SubscriptionHistory({
  athleteId,
  matricule,
  subscriptions,
  payments,
  defaultCurrency,
  today,
}: {
  athleteId: string;
  matricule: string;
  subscriptions: Sub[];
  payments: Pay[];
  defaultCurrency: string;
  today: string;
}) {
  const router = useRouter();
  const [stateAction, setStateAction] = useState<StateAction>(null);
  const [paymentTarget, setPaymentTarget] = useState<PaymentTarget | null>(null);
  const [paymentToCancel, setPaymentToCancel] = useState<Pay | null>(null);

  return (
    <>
      <Card>
        <CardHeader
          eyebrow="Historique"
          title="Abonnements"
          description={`${subscriptions.length} abonnement(s), du plus récent au plus ancien`}
          action={
            <Button variant="ghost" size="sm" onClick={() => setPaymentTarget({ athleteId, subscriptionId: null, label: formatMatricule(matricule) })}>
              <Wallet />
              Paiement
            </Button>
          }
        />
        {subscriptions.length ? (
          <ol className="divide-y divide-line">
            {subscriptions.map((s) => {
              const subPayments = payments.filter((p) => p.subscription_id === s.id);
              return (
                <li key={s.id} className={cn("px-5 py-4", s.state === "cancelled" && "bg-surface-muted/70")}>
                  <div className="flex items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className={cn("font-semibold text-ink", s.state === "cancelled" && "line-through decoration-ink-faint")}>
                          {s.plan_name ?? "Formule personnalisée"}
                        </p>
                        <ValidityBadge status={(s.validity ?? "none") as SubscriptionValidity} />
                        {s.renewed_from_id ? <Badge tone="neutral">Renouvellement</Badge> : null}
                      </div>
                      <p className="tabular mt-1 text-[13px] text-ink-muted">
                        {formatDate(s.starts_on)} → {formatDate(s.ends_on)} · {pluralize(s.length_days ?? 0, "jour")}
                      </p>
                      {s.state_reason ? (
                        <p className="mt-1 text-xs text-ink-muted">
                          Motif : <span className="italic">{s.state_reason}</span>
                        </p>
                      ) : null}
                      <p className="mt-1 text-xs text-ink-faint">
                        Créé le {formatDate(s.created_at?.slice(0, 10))} par {s.created_by_name ?? "—"}
                      </p>
                      {subPayments.length ? (
                        <ul className="mt-2 space-y-1">
                          {subPayments.map((p) => (
                            <li key={p.id} className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[13px]">
                              <Receipt className="size-3.5 text-ink-faint" aria-hidden="true" />
                              <span className={cn("font-semibold text-ink", p.status === "cancelled" && "line-through")}>{formatMoney(p.amount, p.currency ?? "XOF")}</span>
                              <span className="whitespace-nowrap text-ink-muted">
                                {PAYMENT_METHOD_LABELS[(p.method ?? "other") as PaymentMethod]} · {formatDate(p.paid_on)}
                              </span>
                              {p.status === "cancelled" ? (
                                <Badge tone="neutral">Annulé</Badge>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => setPaymentToCancel(p)}
                                  className="ml-auto text-xs font-semibold text-ink-muted underline-offset-2 hover:text-danger-700 hover:underline"
                                >
                                  Annuler
                                </button>
                              )}
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </div>
                    {s.state !== "cancelled" ? (
                      <Dropdown.Root>
                        <Dropdown.Trigger asChild>
                          <Button variant="ghost" size="icon-sm" aria-label="Actions sur l'abonnement">
                            <MoreHorizontal />
                          </Button>
                        </Dropdown.Trigger>
                        <Dropdown.Portal>
                          <Dropdown.Content align="end" sideOffset={4} className="z-50 min-w-52 rounded-md border border-line bg-surface p-1 shadow-raised data-[state=open]:animate-fade-in">
                            <MenuItem onSelect={() => setPaymentTarget({ athleteId, subscriptionId: s.id ?? null, label: `${formatMatricule(matricule)} · ${s.plan_name ?? "abonnement"}` })} icon={<Wallet />}>
                              Enregistrer un paiement
                            </MenuItem>
                            {s.state === "active" && s.validity !== "expired" ? (
                              <MenuItem onSelect={() => setStateAction({ sub: s, to: "suspended" })} icon={<PauseCircle />}>
                                Suspendre
                              </MenuItem>
                            ) : null}
                            {s.state === "suspended" ? (
                              <MenuItem onSelect={() => setStateAction({ sub: s, to: "active" })} icon={<PlayCircle />}>
                                Réactiver
                              </MenuItem>
                            ) : null}
                            <Dropdown.Separator className="my-1 h-px bg-line" />
                            <MenuItem danger onSelect={() => setStateAction({ sub: s, to: "cancelled" })} icon={<Ban />}>
                              Annuler l&apos;abonnement
                            </MenuItem>
                          </Dropdown.Content>
                        </Dropdown.Portal>
                      </Dropdown.Root>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ol>
        ) : (
          <EmptyState compact icon={<CalendarX2 />} title="Aucun abonnement" description="Créez un abonnement pour autoriser l'accès au stade." />
        )}
        {payments.some((p) => !p.subscription_id) ? (
          <div className="border-t border-line px-5 py-3 text-[13px] text-ink-muted">
            Paiements sans abonnement associé :{" "}
            {payments
              .filter((p) => !p.subscription_id)
              .map((p) => `${formatMoney(p.amount, p.currency ?? "XOF")} (${formatDate(p.paid_on)})`)
              .join(", ")}
          </div>
        ) : null}
      </Card>

      {stateAction ? (
        <ReasonDialog
          open
          onOpenChange={(o) => !o && setStateAction(null)}
          title={STATE_COPY[stateAction.to].title}
          description={STATE_COPY[stateAction.to].text}
          confirmLabel={STATE_COPY[stateAction.to].confirm}
          tone={STATE_COPY[stateAction.to].tone}
          onSubmit={async (reason) => {
            const res = await setSubscriptionState({ subscriptionId: stateAction.sub.id ?? "", state: stateAction.to, reason });
            if (res.ok) router.refresh();
            return res;
          }}
        />
      ) : null}

      {paymentToCancel ? (
        <ReasonDialog
          open
          onOpenChange={(o) => !o && setPaymentToCancel(null)}
          title="Annuler le paiement"
          description={`Le paiement de ${formatMoney(paymentToCancel.amount, paymentToCancel.currency ?? "XOF")} sera marqué comme annulé (il reste visible dans l'historique).`}
          confirmLabel="Annuler le paiement"
          tone="danger"
          onSubmit={async (reason) => {
            const res = await cancelPayment({ paymentId: paymentToCancel.id ?? "", reason });
            if (res.ok) router.refresh();
            return res;
          }}
        >
          <p className="flex items-center gap-2 text-sm text-ink-muted">
            <XCircle className="size-4" aria-hidden="true" />
            Utilisez cette option pour corriger une erreur de saisie.
          </p>
        </ReasonDialog>
      ) : null}

      <PaymentDialog target={paymentTarget} onClose={() => setPaymentTarget(null)} today={today} defaultCurrency={defaultCurrency} onDone={() => router.refresh()} />
    </>
  );
}

function MenuItem({ children, icon, onSelect, danger }: { children: React.ReactNode; icon: React.ReactNode; onSelect: () => void; danger?: boolean }) {
  return (
    <Dropdown.Item
      onSelect={onSelect}
      className={cn(
        "flex cursor-pointer select-none items-center gap-2.5 rounded-[5px] px-2.5 py-2 text-sm outline-none [&_svg]:size-4",
        danger ? "text-danger-700 data-[highlighted]:bg-danger-50" : "text-ink data-[highlighted]:bg-surface-sunken",
      )}
    >
      {icon}
      {children}
    </Dropdown.Item>
  );
}
