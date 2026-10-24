import type { Metadata } from "next";
import { ImageIcon, ShieldCheck } from "lucide-react";
import { requireAdmin } from "@/server/auth";
import { getPlans, getSettings } from "@/server/queries/common";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { BrandMark } from "@/components/brand/brand";
import { SettingsForm } from "@/components/settings/settings-form";
import { PlansManager } from "@/components/settings/plans-manager";

export const metadata: Metadata = { title: "Paramètres" };

export default async function SettingsPage() {
  await requireAdmin();
  const [settings, plans] = await Promise.all([getSettings(), getPlans()]);
  const currency = settings?.default_currency ?? "XOF";

  return (
    <>
      <PageHeader eyebrow="Administration" title="Paramètres" description="Règles de fonctionnement du stade. Chaque modification est journalisée." />
      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <Card>
          <CardHeader title="Paramètres généraux" />
          <CardBody>
            <SettingsForm
              initial={{
                stadiumName: settings?.stadium_name ?? "Stade du 26 Mars",
                timezone: settings?.timezone ?? "Africa/Bamako",
                expiringSoonDays: settings?.expiring_soon_days ?? 7,
                longVisitHours: settings?.long_visit_hours ?? 6,
                defaultCurrency: currency,
                offlineSnapshotHours: settings?.offline_snapshot_hours ?? 24,
              }}
            />
          </CardBody>
        </Card>
        <div className="min-w-0 space-y-6">
          <Card>
            <CardHeader title="Formules d'abonnement" description="Durées et tarifs proposés lors de la création ou du renouvellement." />
            <PlansManager plans={plans} defaultCurrency={currency} />
          </Card>
          <Card>
            <CardHeader title="Identité visuelle" />
            <CardBody className="space-y-3 text-sm text-ink-muted">
              <div className="flex items-center gap-3">
                <BrandMark />
                <p>
                  <span className="font-semibold text-ink">Identité provisoire.</span> Aucun logo officiel n&apos;a été fourni.
                </p>
              </div>
              <p className="flex gap-2">
                <ImageIcon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                <span>Pour intégrer le logo officiel, suivez les instructions du fichier <span className="font-semibold text-ink-soft">public/brand/LISEZMOI.md</span>.</span>
              </p>
              <p className="flex gap-2">
                <ShieldCheck className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                Aucune donnée personnelle des sportifs n&apos;est collectée : uniquement le matricule.
              </p>
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  );
}
