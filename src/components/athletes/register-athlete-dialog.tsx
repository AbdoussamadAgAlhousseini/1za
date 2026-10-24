"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AlertCircle, CheckCircle2, ShieldCheck, UserPlus } from "lucide-react";
import { Dialog, DialogContent, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { InlineAlert } from "@/components/ui/states";
import { MatriculeInput } from "@/components/forms/matricule-input";
import { SubscriptionFields, draftToInput, initialSubscriptionDraft, type SubscriptionDraft } from "@/components/forms/subscription-fields";
import { registerAthlete } from "@/server/actions/athletes";
import { safeAction } from "@/lib/safe-action";
import { explainMatriculeError, formatMatricule, isValidMatricule } from "@/lib/domain/matricule";
import type { PlanOption } from "@/server/queries/common";

export function RegisterAthleteDialog({
  open,
  onOpenChange,
  plans,
  today,
  defaultCurrency,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  plans: PlanOption[];
  today: string;
  defaultCurrency: string;
}) {
  const router = useRouter();
  const [matricule, setMatricule] = useState("");
  const [touched, setTouched] = useState(false);
  const [registeredOn, setRegisteredOn] = useState(today);
  const [withSubscription, setWithSubscription] = useState(true);
  const [draft, setDraft] = useState<SubscriptionDraft>(() => initialSubscriptionDraft({ plans, startsOn: today, today, defaultCurrency }));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isDuplicate, setIsDuplicate] = useState(false);
  const [pending, startTransition] = useTransition();

  const localError = touched ? explainMatriculeError(matricule) : null;

  const reset = () => {
    setMatricule("");
    setTouched(false);
    setRegisteredOn(today);
    setWithSubscription(true);
    setDraft(initialSubscriptionDraft({ plans, startsOn: today, today, defaultCurrency }));
    setErrors({});
    setFormError(null);
    setIsDuplicate(false);
  };

  const submit = () => {
    setTouched(true);
    if (explainMatriculeError(matricule)) return;
    startTransition(async () => {
      const res = await safeAction(() =>
        registerAthlete({
          matricule,
          registeredOn,
          withSubscription,
          subscription: withSubscription ? draftToInput(draft) : undefined,
        }),
      );
      if (!res.ok) {
        setErrors(res.fieldErrors ?? {});
        setFormError(res.fieldErrors ? null : res.message);
        setIsDuplicate(res.code === "ERR_MATRICULE_DUPLICATE");
        return;
      }
      if (res.data.warning) toast.warning(res.data.warning);
      else toast.success(`Sportif ${formatMatricule(matricule)} enregistré.`);
      onOpenChange(false);
      reset();
      router.push(`/sportifs/${res.data.athleteId}`);
    });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) reset();
      }}
    >
      <DialogContent
        size="lg"
        title="Enregistrer un sportif"
        description="Saisissez uniquement le matricule communiqué par l'administration. Aucune autre information personnelle n'est demandée."
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
          className="space-y-6"
          noValidate
        >
          {formError ? (
            <InlineAlert tone="danger" icon={<AlertCircle />}>
              {formError}
            </InlineAlert>
          ) : null}

          <Field
            label="Matricule"
            error={errors.matricule ?? localError ?? undefined}
            hint="Initiale du prénom + initiale du nom + 5 premiers chiffres du téléphone. Exemple fictif : AD76214."
          >
            {(p) => (
              <div className="relative">
                <MatriculeInput
                  {...p}
                  autoFocus
                  value={matricule}
                  onValueChange={(v) => {
                    setMatricule(v);
                    setIsDuplicate(false);
                    if (errors.matricule) setErrors(({ matricule: _m, ...rest }) => rest);
                  }}
                  onBlur={() => setTouched(true)}
                />
                {isValidMatricule(matricule) && !errors.matricule ? (
                  <CheckCircle2 className="absolute right-4 top-1/2 size-5 -translate-y-1/2 text-success-600" aria-label="Format valide" />
                ) : null}
              </div>
            )}
          </Field>

          {isDuplicate ? (
            <InlineAlert tone="warning" icon={<ShieldCheck />} title="Procédure en cas de doublon">
              <ol className="list-decimal space-y-0.5 pl-4">
                <li>Recherchez ce matricule dans la liste : la personne est peut-être déjà inscrite.</li>
                <li>S&apos;il s&apos;agit bien de deux personnes différentes, n&apos;enregistrez rien et ne modifiez pas le matricule vous-même.</li>
                <li>Signalez le cas à la direction : une règle de différenciation doit être décidée (voir la documentation).</li>
              </ol>
            </InlineAlert>
          ) : null}

          <Field label="Date d'inscription" error={errors.registeredOn}>
            {(p) => <Input {...p} type="date" max={today} value={registeredOn} onChange={(e) => setRegisteredOn(e.target.value)} className="sm:w-56" />}
          </Field>

          <div className="rounded-lg border border-line bg-surface-muted/60">
            <label className="flex cursor-pointer items-start gap-3 px-4 py-3.5">
              <input
                type="checkbox"
                className="mt-0.5 size-4 accent-pitch-700"
                checked={withSubscription}
                onChange={(e) => setWithSubscription(e.target.checked)}
              />
              <span>
                <span className="block text-sm font-semibold text-ink">Créer le premier abonnement</span>
                <span className="block text-[13px] text-ink-muted">Recommandé : sans abonnement, l&apos;entrée au stade sera refusée.</span>
              </span>
            </label>
            {withSubscription ? (
              <div className="border-t border-line bg-surface px-4 py-4">
                <SubscriptionFields draft={draft} onChange={setDraft} plans={plans} errors={errors} />
              </div>
            ) : null}
          </div>

          <DialogFooter>
            <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={pending}>
              Annuler
            </Button>
            <Button type="submit" loading={pending}>
              {pending ? null : <UserPlus />}
              Enregistrer le sportif
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
