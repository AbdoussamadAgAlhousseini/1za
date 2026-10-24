import type { Metadata } from "next";
import Link from "next/link";
import { AlertCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { InlineAlert } from "@/components/ui/states";
import { NewPasswordForm } from "./new-password-form";

export const metadata: Metadata = { title: "Nouveau mot de passe" };

export default async function ResetPasswordPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const hasSession = Boolean(data?.claims?.sub);

  return (
    <div className="animate-slide-up">
      <p className="eyebrow text-gold-600">Sécurité du compte</p>
      <h2 className="mt-1 font-display text-4xl font-semibold uppercase tracking-[0.02em]">Nouveau mot de passe</h2>
      {hasSession ? (
        <>
          <p className="mt-2 text-sm text-ink-muted">Choisissez un mot de passe personnel que vous ne réutilisez nulle part ailleurs.</p>
          <NewPasswordForm />
        </>
      ) : (
        <div className="mt-8 space-y-5">
          <InlineAlert tone="warning" icon={<AlertCircle />} title="Lien invalide ou expiré">
            Ouvrez le lien reçu par e-mail dans ce navigateur, ou refaites une demande.
          </InlineAlert>
          <Link href="/mot-de-passe-oublie" className="text-sm font-semibold text-pitch-700 hover:underline">
            Refaire une demande
          </Link>
        </div>
      )}
    </div>
  );
}
