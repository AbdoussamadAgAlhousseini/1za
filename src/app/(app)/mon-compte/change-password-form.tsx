"use client";

import { useActionState, useRef, useState } from "react";
import { AlertCircle, Check, CheckCircle2, KeyRound } from "lucide-react";
import { changeOwnPassword } from "@/server/actions/auth";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { InlineAlert } from "@/components/ui/states";
import { cn } from "@/lib/cn";

export function ChangePasswordForm({ minLength }: { minLength: number }) {
  const [value, setValue] = useState("");
  const formRef = useRef<HTMLFormElement>(null);
  const [state, action, pending] = useActionState(async (prev: Awaited<ReturnType<typeof changeOwnPassword>> | null, formData: FormData) => {
    const result = await changeOwnPassword(prev, formData);
    if (result.ok) setValue("");
    return result;
  }, null);
  const errors = state && !state.ok ? state.fieldErrors : undefined;

  const rules = [
    { label: `${minLength} caractères minimum`, ok: value.length >= minLength },
    { label: "Une lettre minuscule", ok: /[a-z]/.test(value) },
    { label: "Une lettre majuscule", ok: /[A-Z]/.test(value) },
    { label: "Un chiffre", ok: /[0-9]/.test(value) },
  ];

  return (
    <form ref={formRef} action={action} className="space-y-5" noValidate>
      {state?.ok ? (
        <InlineAlert tone="success" icon={<CheckCircle2 />}>
          {state.message}
        </InlineAlert>
      ) : null}
      {state && !state.ok && !state.fieldErrors ? (
        <InlineAlert tone="danger" icon={<AlertCircle />}>
          {state.message}
        </InlineAlert>
      ) : null}
      <Field label="Mot de passe actuel" error={errors?.current}>
        {(p) => <Input {...p} name="current" type="password" autoComplete="current-password" required className="h-11" />}
      </Field>
      <Field label="Nouveau mot de passe" error={errors?.password}>
        {(p) => (
          <Input {...p} name="password" type="password" autoComplete="new-password" required className="h-11" value={value} onChange={(e) => setValue(e.target.value)} />
        )}
      </Field>
      <ul className="grid gap-x-4 gap-y-1.5 text-[13px] sm:grid-cols-2" aria-label="Exigences du mot de passe">
        {rules.map((rule) => (
          <li key={rule.label} className={cn("flex items-center gap-1.5", rule.ok ? "text-success-700" : "text-ink-muted")}>
            <Check className={cn("size-3.5", rule.ok ? "opacity-100" : "opacity-30")} aria-hidden="true" />
            {rule.label}
            <span className="sr-only">{rule.ok ? " : respecté" : " : non respecté"}</span>
          </li>
        ))}
      </ul>
      <Field label="Confirmer le nouveau mot de passe" error={errors?.confirm}>
        {(p) => <Input {...p} name="confirm" type="password" autoComplete="new-password" required className="h-11" />}
      </Field>
      <Button type="submit" size="lg" loading={pending}>
        {pending ? null : <KeyRound />}
        Enregistrer le nouveau mot de passe
      </Button>
    </form>
  );
}
