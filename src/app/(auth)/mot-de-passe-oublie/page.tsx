import type { Metadata } from "next";
import { ResetRequestForm } from "./reset-request-form";

export const metadata: Metadata = { title: "Mot de passe oublié" };

export default function ForgotPasswordPage() {
  return (
    <div className="animate-slide-up">
      <p className="eyebrow text-gold-600">Accès au compte</p>
      <h2 className="mt-1 font-display text-4xl font-semibold uppercase tracking-[0.02em]">Mot de passe oublié</h2>
      <p className="mt-2 text-sm text-ink-muted">
        Indiquez l&apos;adresse e-mail de votre compte. Vous recevrez un lien pour choisir un nouveau mot de passe.
      </p>
      <ResetRequestForm />
    </div>
  );
}
