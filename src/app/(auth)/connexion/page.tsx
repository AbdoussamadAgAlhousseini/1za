import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSessionLookup, homePathFor } from "@/server/auth";
import { SignInForm } from "./sign-in-form";

export const metadata: Metadata = { title: "Connexion" };

export default async function SignInPage() {
  const lookup = await getSessionLookup();
  if (lookup.status === "ok") redirect(homePathFor(lookup.staff.role));

  return (
    <div className="animate-slide-up">
      <p className="eyebrow text-gold-600">Bienvenue</p>
      <h2 className="mt-1 font-display text-4xl font-semibold uppercase tracking-[0.02em]">Connexion</h2>
      <p className="mt-2 text-sm text-ink-muted">Choisissez votre profil, puis saisissez vos identifiants personnels.</p>
      <SignInForm />
    </div>
  );
}
