"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { Eye, EyeOff, LogIn, AlertCircle } from "lucide-react";
import { signIn } from "@/server/actions/auth";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { InlineAlert } from "@/components/ui/states";

export function SignInForm({ linkExpired }: { linkExpired: boolean }) {
  const [state, action, pending] = useActionState(signIn, null);
  const [showPassword, setShowPassword] = useState(false);
  const errors = state && !state.ok ? state.fieldErrors : undefined;

  return (
    <form action={action} className="mt-8 space-y-5" noValidate>
      {linkExpired ? (
        <InlineAlert tone="warning" icon={<AlertCircle />} title="Lien expiré ou déjà utilisé">
          Refaites une demande de réinitialisation du mot de passe.
        </InlineAlert>
      ) : null}
      {state && !state.ok && !state.fieldErrors ? (
        <InlineAlert tone="danger" icon={<AlertCircle />}>
          {state.message}
        </InlineAlert>
      ) : null}

      <Field label="Adresse e-mail" error={errors?.email}>
        {(p) => (
          <Input {...p} name="email" type="email" autoComplete="username" inputMode="email" required autoFocus className="h-12 text-[15px]" />
        )}
      </Field>

      <Field label="Mot de passe" error={errors?.password}>
        {(p) => (
          <div className="relative">
            <Input
              {...p}
              name="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              required
              className="h-12 pr-12 text-[15px]"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-1.5 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-md text-ink-muted hover:bg-surface-sunken hover:text-ink"
              aria-label={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}
              aria-pressed={showPassword}
            >
              {showPassword ? <EyeOff className="size-[18px]" /> : <Eye className="size-[18px]" />}
            </button>
          </div>
        )}
      </Field>

      <div className="flex justify-end">
        <Link href="/mot-de-passe-oublie" className="text-sm font-semibold text-pitch-700 underline-offset-4 hover:underline">
          Mot de passe oublié ?
        </Link>
      </div>

      <Button type="submit" size="lg" className="w-full" loading={pending}>
        {pending ? null : <LogIn />}
        Se connecter
      </Button>
    </form>
  );
}
