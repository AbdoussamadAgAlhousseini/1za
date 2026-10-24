"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { AlertCircle, Wallet } from "lucide-react";
import { Dialog, DialogContent, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import { InlineAlert } from "@/components/ui/states";
import { recordPayment } from "@/server/actions/subscriptions";
import { safeAction } from "@/lib/safe-action";
import { PAYMENT_METHOD_LABELS, PAYMENT_METHODS } from "@/lib/domain/status";
import { formatDate } from "@/lib/domain/format";

export interface PaymentTarget {
  athleteId: string;
  subscriptionId: string | null;
  label: string;
}

export function PaymentDialog({
  target,
  onClose,
  today,
  defaultCurrency,
  onDone,
}: {
  target: PaymentTarget | null;
  onClose: () => void;
  today: string;
  defaultCurrency: string;
  onDone?: () => void;
}) {
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState(defaultCurrency);
  const [method, setMethod] = useState("cash");
  const [reference, setReference] = useState("");
  const [paidOn, setPaidOn] = useState(today);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <Dialog
      open={target !== null}
      onOpenChange={(o) => {
        if (!o) onClose();
        else {
          setErrors({});
          setFormError(null);
        }
      }}
    >
      <DialogContent size="md" title="Enregistrer un paiement" description={target ? `${target.label} · paiement reçu hors application (espèces, mobile money, virement…).` : ""}>
        <form
          className="space-y-4"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            if (!target) return;
            startTransition(async () => {
              const res = await safeAction(() =>
                recordPayment({
                  athleteId: target.athleteId,
                  subscriptionId: target.subscriptionId,
                  payment: { amount: amount.replace(",", "."), currency, method, reference: reference || undefined, paidOn },
                }),
              );
              if (!res.ok) {
                setErrors(res.fieldErrors ?? {});
                setFormError(res.message);
                return;
              }
              toast.success(res.message ?? "Paiement enregistré.");
              setAmount("");
              setReference("");
              onClose();
              onDone?.();
            });
          }}
        >
          {formError ? (
            <InlineAlert tone="danger" icon={<AlertCircle />}>
              {formError}
            </InlineAlert>
          ) : null}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Montant" error={errors["payment.amount"]}>
              {(p) => <Input {...p} inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} autoFocus />}
            </Field>
            <Field label="Devise" error={errors["payment.currency"]}>
              {(p) => <Input {...p} maxLength={3} value={currency} onChange={(e) => setCurrency(e.target.value.toUpperCase())} />}
            </Field>
            <Field label="Mode de paiement" error={errors["payment.method"]}>
              {(p) => (
                <Select {...p} value={method} onChange={(e) => setMethod(e.target.value)}>
                  {PAYMENT_METHODS.map((m) => (
                    <option key={m} value={m}>
                      {PAYMENT_METHOD_LABELS[m]}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <Field label="Date du paiement" error={errors["payment.paidOn"]} hint={`Au plus tard le ${formatDate(today)}.`}>
              {(p) => <Input {...p} type="date" max={today} value={paidOn} onChange={(e) => setPaidOn(e.target.value)} />}
            </Field>
            <Field label="Référence" optional className="sm:col-span-2" error={errors["payment.reference"]}>
              {(p) => <Input {...p} maxLength={80} value={reference} onChange={(e) => setReference(e.target.value)} />}
            </Field>
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={onClose} disabled={pending}>
              Annuler
            </Button>
            <Button type="submit" loading={pending}>
              {pending ? null : <Wallet />}
              Enregistrer le paiement
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
