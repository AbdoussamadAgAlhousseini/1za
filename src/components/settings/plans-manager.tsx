"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AlertCircle, CalendarRange, Pencil, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter } from "@/components/ui/dialog";
import { Field, Input } from "@/components/ui/field";
import { EmptyState, InlineAlert } from "@/components/ui/states";
import { savePlan } from "@/server/actions/settings";
import { safeAction } from "@/lib/safe-action";
import { formatMoney, pluralize } from "@/lib/domain/format";
import type { PlanOption } from "@/server/queries/common";
import { cn } from "@/lib/cn";

export function PlansManager({ plans, defaultCurrency }: { plans: PlanOption[]; defaultCurrency: string }) {
  const router = useRouter();
  const [editing, setEditing] = useState<PlanOption | "new" | null>(null);
  return (
    <>
      {plans.length ? (
        <ul className="divide-y divide-line">
          {plans.map((p) => (
            <li key={p.id} className={cn("flex items-center gap-4 px-5 py-3.5", !p.is_active && "bg-surface-muted/70")}>
              <span className="grid size-9 place-items-center rounded-full bg-pitch-50 text-pitch-700">
                <CalendarRange className="size-4" aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-ink">
                  {p.name} {!p.is_active ? <Badge tone="neutral" className="ml-1">Désactivée</Badge> : null}
                </p>
                <p className="text-[13px] text-ink-muted">
                  {pluralize(p.duration_days, "jour")} · {p.price !== null ? formatMoney(p.price, p.currency) : "prix libre"}
                </p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setEditing(p)}>
                <Pencil />
                Modifier
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState compact icon={<CalendarRange />} title="Aucune formule" description="Définissez les formules vendues par le stade (durée et tarif)." />
      )}
      <div className="border-t border-line px-5 py-3">
        <Button variant="secondary" size="sm" onClick={() => setEditing("new")}>
          <Plus />
          Nouvelle formule
        </Button>
      </div>
      {editing ? (
        <PlanDialog
          plan={editing === "new" ? null : editing}
          defaultCurrency={defaultCurrency}
          onClose={() => setEditing(null)}
          onDone={() => {
            setEditing(null);
            router.refresh();
          }}
        />
      ) : null}
    </>
  );
}

function PlanDialog({ plan, defaultCurrency, onClose, onDone }: { plan: PlanOption | null; defaultCurrency: string; onClose: () => void; onDone: () => void }) {
  const [name, setName] = useState(plan?.name ?? "");
  const [durationDays, setDuration] = useState(String(plan?.duration_days ?? 30));
  const [price, setPrice] = useState(plan?.price !== null && plan?.price !== undefined ? String(plan.price) : "");
  const [currency, setCurrency] = useState(plan?.currency ?? defaultCurrency);
  const [isActive, setActive] = useState(plan?.is_active ?? true);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent title={plan ? "Modifier la formule" : "Nouvelle formule"} description="Les abonnements déjà créés conservent leurs dates : la modification ne s'applique qu'aux nouveaux abonnements.">
        <form
          className="space-y-4"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            start(async () => {
              const res = await safeAction(() => savePlan({ id: plan?.id ?? null, name, durationDays, price: price.replace(",", "."), currency, isActive }));
              if (!res.ok) {
                setErrors(res.fieldErrors ?? {});
                setFormError(res.fieldErrors ? null : res.message);
                return;
              }
              toast.success(res.message ?? "Formule enregistrée.");
              onDone();
            });
          }}
        >
          {formError ? <InlineAlert tone="danger" icon={<AlertCircle />}>{formError}</InlineAlert> : null}
          <Field label="Nom" error={errors.name}>
            {(p) => <Input {...p} value={name} maxLength={60} onChange={(e) => setName(e.target.value)} autoFocus className="h-11" placeholder="Mensuel" />}
          </Field>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Durée (jours)" error={errors.durationDays}>
              {(p) => <Input {...p} type="number" min={1} max={3660} value={durationDays} onChange={(e) => setDuration(e.target.value)} className="h-11" />}
            </Field>
            <Field label="Prix" optional error={errors.price}>
              {(p) => <Input {...p} inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} className="h-11" />}
            </Field>
            <Field label="Devise" error={errors.currency}>
              {(p) => <Input {...p} maxLength={3} value={currency} onChange={(e) => setCurrency(e.target.value.toUpperCase())} className="h-11" />}
            </Field>
          </div>
          <label className="flex cursor-pointer items-center gap-3 rounded-md border border-line px-4 py-3 text-sm">
            <input type="checkbox" className="size-4 accent-pitch-700" checked={isActive} onChange={(e) => setActive(e.target.checked)} />
            <span>
              <span className="block font-semibold text-ink">Formule en vente</span>
              <span className="block text-[13px] text-ink-muted">Décochez pour la retirer des choix sans effacer l&apos;historique.</span>
            </span>
          </label>
          <DialogFooter>
            <Button variant="secondary" onClick={onClose} disabled={pending}>
              Annuler
            </Button>
            <Button type="submit" loading={pending}>
              Enregistrer
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
