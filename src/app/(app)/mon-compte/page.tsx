import type { Metadata } from "next";
import { KeyRound, ShieldCheck, Smartphone, UserRound } from "lucide-react";
import { requireStaff } from "@/server/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { ROLE_LABELS } from "@/lib/domain/status";
import { formatPhone } from "@/lib/auth/identity";
import { ChangePasswordForm } from "./change-password-form";
import { InstallAppCard } from "@/components/pwa/install-app-card";

export const metadata: Metadata = { title: "Mon compte" };

export default async function AccountPage() {
  const staff = await requireStaff();
  const supabase = await createClient();
  const { data: profile } = await supabase.from("profiles").select("login_phone").eq("id", staff.userId).maybeSingle();

  return (
    <>
      <PageHeader eyebrow="Compte" title="Mon compte" description="Vos informations de connexion et la sécurité de votre accès." />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <div className="space-y-6">
          <Card>
            <CardHeader title="Identité" />
            <CardBody>
              <dl className="space-y-4 text-sm">
                <div className="flex items-center gap-3">
                  <UserRound className="size-5 text-ink-faint" aria-hidden="true" />
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-[0.06em] text-ink-muted">Nom affiché</dt>
                    <dd className="font-semibold text-ink">{staff.displayName}</dd>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <ShieldCheck className="size-5 text-ink-faint" aria-hidden="true" />
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-[0.06em] text-ink-muted">Rôle</dt>
                    <dd className="font-semibold text-ink">{ROLE_LABELS[staff.role]}</dd>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Smartphone className="size-5 text-ink-faint" aria-hidden="true" />
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-[0.06em] text-ink-muted">Identifiant de connexion</dt>
                    <dd className="font-semibold text-ink">
                      {staff.role === "admin" ? "Mot de passe administrateur seul" : formatPhone(profile?.login_phone)}
                    </dd>
                  </div>
                </div>
              </dl>
            </CardBody>
          </Card>
          <InstallAppCard />
        </div>

        <Card>
          <CardHeader
            title={
              <span className="flex items-center gap-2">
                <KeyRound className="size-4 text-pitch-600" aria-hidden="true" />
                Modifier mon mot de passe
              </span>
            }
            description={
              staff.role === "admin"
                ? "Le mot de passe est le seul identifiant de l'administration : choisissez-le long et unique (12 caractères minimum)."
                : "Choisissez un mot de passe personnel que vous ne partagez avec personne."
            }
          />
          <CardBody>
            <ChangePasswordForm minLength={staff.role === "admin" ? 12 : 10} />
          </CardBody>
        </Card>
      </div>
    </>
  );
}
