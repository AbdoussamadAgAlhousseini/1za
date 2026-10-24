"use client";

import Link from "next/link";
import { useActionState } from "react";
import { ArrowLeft, MailCheck, Send, AlertCircle } from "lucide-react";
import { requestPasswordReset } from "@/server/actions/auth";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { InlineAlert } from "@/components/ui/states";

export function ResetRequestForm() {
  const [state, action, pending] = useActionState(requestPasswordReset, null);

  if (state?.ok) {
    return (
      <div className="mt-8 space-y-6">
        <InlineAlert tone="success" icon={<MailCheck />} title="Demande enregistrée">
          {state.message}
        </InlineAlert>
        <Link href="/connexion" className="inline-flex items-center gap-2 text-sm font-semibold text-pitch-700 hover:underline">
          <ArrowLeft className="size-4" aria-hidden="true" />
          Retour à la connexion
        </Link>
      </div>
    );
  }

  return (
    <form action={action} className="mt-8 space-y-5" noValidate>
      {state && !state.ok && !state.fieldErrors ? (
        <InlineAlert tone="danger" icon={<AlertCircle />}>
          {state.message}
        </InlineAlert>
      ) : null}
      <Field label="Adresse e-mail" error={state && !state.ok ? state.fieldErrors?.email : undefined}>
        {(p) => <Input {...p} name="email" type="email" autoComplete="email" required autoFocus className="h-12 text-[15px]" />}
      </Field>
      <Button type="submit" size="lg" className="w-full" loading={pending}>
        {pending ? null : <Send />}
        Envoyer le lien
      </Button>
      <Link href="/connexion" className="inline-flex items-center gap-2 text-sm font-semibold text-pitch-700 hover:underline">
        <ArrowLeft className="size-4" aria-hidden="true" />
        Retour à la connexion
      </Link>
    </form>
  );
}
