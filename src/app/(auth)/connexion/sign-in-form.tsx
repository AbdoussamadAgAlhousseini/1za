"use client";

import { useActionState, useState } from "react";
import { AlertCircle, Eye, EyeOff, LogIn, ShieldCheck, Smartphone } from "lucide-react";
import { signIn } from "@/server/actions/auth";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { InlineAlert } from "@/components/ui/states";
import { cn } from "@/lib/cn";

type Mode = "agent" | "admin";

function PasswordInput(props: React.ComponentProps<typeof Input>) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <Input {...props} type={visible ? "text" : "password"} className="h-12 pr-12 text-[15px]" />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        className="absolute right-1.5 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-md text-ink-muted hover:bg-surface-sunken hover:text-ink"
        aria-label={visible ? "Masquer le mot de passe" : "Afficher le mot de passe"}
        aria-pressed={visible}
      >
        {visible ? <EyeOff className="size-[18px]" /> : <Eye className="size-[18px]" />}
      </button>
    </div>
  );
}

export function SignInForm() {
  const [mode, setMode] = useState<Mode>("agent");
  const [state, action, pending] = useActionState(signIn, null);
  const errors = state && !state.ok ? state.fieldErrors : undefined;

  return (
    <div className="mt-8">
      <div role="tablist" aria-label="Profil de connexion" className="grid grid-cols-2 gap-1 rounded-lg border border-line bg-surface-sunken p-1">
        {(
          [
            ["agent", "Agent de contrôle", Smartphone],
            ["admin", "Administration", ShieldCheck],
          ] as const
        ).map(([key, label, Icon]) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={mode === key}
            onClick={() => setMode(key)}
            className={cn(
              "flex h-11 items-center justify-center gap-2 rounded-md text-sm font-semibold transition-all",
              mode === key ? "bg-surface text-ink shadow-card" : "text-ink-muted hover:text-ink",
            )}
          >
            <Icon className={cn("size-4", mode === key ? "text-pitch-600" : "")} aria-hidden="true" />
            {label}
          </button>
        ))}
      </div>

      <form key={mode} action={action} className="mt-6 space-y-5" noValidate>
        <input type="hidden" name="mode" value={mode} />
        {state && !state.ok && !state.fieldErrors ? (
          <InlineAlert tone="danger" icon={<AlertCircle />}>
            {state.message}
          </InlineAlert>
        ) : null}

        {mode === "agent" ? (
          <Field label="Numéro de téléphone" error={errors?.phone} hint="Le numéro communiqué à l'administration, avec ou sans indicatif +223.">
            {(p) => (
              <Input
                {...p}
                name="phone"
                type="tel"
                inputMode="tel"
                autoComplete="username"
                placeholder="76 12 34 56"
                required
                autoFocus
                className="h-12 text-lg font-semibold tracking-[0.04em]"
              />
            )}
          </Field>
        ) : (
          <>
            {/* Identifiant implicite, utile aux gestionnaires de mots de passe. */}
            <input type="text" name="username" autoComplete="username" value="Administration" readOnly hidden />
            <div className="flex items-center gap-3 rounded-lg border border-line bg-surface px-4 py-3">
              <span className="grid size-10 place-items-center rounded-full bg-pitch-800 text-gold-300">
                <ShieldCheck className="size-5" aria-hidden="true" />
              </span>
              <div className="leading-tight">
                <p className="text-sm font-semibold text-ink">Compte administrateur</p>
                <p className="text-xs text-ink-muted">Accès complet à la gestion du stade</p>
              </div>
            </div>
          </>
        )}

        <Field label={mode === "admin" ? "Mot de passe administrateur" : "Mot de passe"} error={errors?.password}>
          {(p) => <PasswordInput {...p} name="password" autoComplete="current-password" required autoFocus={mode === "admin"} />}
        </Field>

        <Button type="submit" size="lg" className="w-full" loading={pending}>
          {pending ? null : <LogIn />}
          Se connecter
        </Button>

        <p className="rounded-md bg-surface-sunken/70 px-3.5 py-2.5 text-[13px] leading-relaxed text-ink-muted">
          <span className="font-semibold text-ink-soft">Mot de passe oublié ?</span>{" "}
          {mode === "agent"
            ? "Demandez à l'administrateur de le réinitialiser depuis la page Personnel."
            : "Suivez la procédure de récupération décrite dans la documentation (accès Supabase requis)."}
        </p>
      </form>
    </div>
  );
}
