"use client";

import { useActionState, useState } from "react";
import { Check, KeyRound, AlertCircle } from "lucide-react";
import { updatePassword } from "@/server/actions/auth";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { InlineAlert } from "@/components/ui/states";
import { cn } from "@/lib/cn";

const RULES = [
  { label: "10 caractères minimum", test: (v: string) => v.length >= 10 },
  { label: "Une lettre minuscule", test: (v: string) => /[a-z]/.test(v) },
  { label: "Une lettre majuscule", test: (v: string) => /[A-Z]/.test(v) },
  { label: "Un chiffre", test: (v: string) => /[0-9]/.test(v) },
];

export function NewPasswordForm() {
  const [state, action, pending] = useActionState(updatePassword, null);
  const [value, setValue] = useState("");
  const errors = state && !state.ok ? state.fieldErrors : undefined;

  return (
    <form action={action} className="mt-8 space-y-5" noValidate>
      {state && !state.ok && !state.fieldErrors ? (
        <InlineAlert tone="danger" icon={<AlertCircle />}>
          {state.message}
        </InlineAlert>
      ) : null}
      <Field label="Nouveau mot de passe" error={errors?.password}>
        {(p) => (
          <Input
            {...p}
            name="password"
            type="password"
            autoComplete="new-password"
            required
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="h-12 text-[15px]"
          />
        )}
      </Field>
      <ul className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-[13px]" aria-label="Exigences du mot de passe">
        {RULES.map((rule) => {
          const ok = rule.test(value);
          return (
            <li key={rule.label} className={cn("flex items-center gap-1.5", ok ? "text-success-700" : "text-ink-muted")}>
              <Check className={cn("size-3.5", ok ? "opacity-100" : "opacity-30")} aria-hidden="true" />
              {rule.label}
              <span className="sr-only">{ok ? " : respecté" : " : non respecté"}</span>
            </li>
          );
        })}
      </ul>
      <Field label="Confirmer le mot de passe" error={errors?.confirm}>
        {(p) => <Input {...p} name="confirm" type="password" autoComplete="new-password" required className="h-12 text-[15px]" />}
      </Field>
      <Button type="submit" size="lg" className="w-full" loading={pending}>
        {pending ? null : <KeyRound />}
        Enregistrer le mot de passe
      </Button>
    </form>
  );
}
