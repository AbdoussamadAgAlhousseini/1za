import type { Metadata } from "next";
import { requireAdmin } from "@/server/auth";
import { listAthletes } from "@/server/actions/athletes";
import { getPlans, getSettings, getToday } from "@/server/queries/common";
import { athleteStatusFilter } from "@/lib/validation/athletes";
import { PageHeader } from "@/components/ui/page-header";
import { AthletesTable } from "@/components/athletes/athletes-table";

export const metadata: Metadata = { title: "Sportifs" };

export default async function AthletesPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const staff = await requireAdmin();
  const params = await searchParams;
  const status = athleteStatusFilter.catch("all").parse(params.statut);
  const [initial, plans, today, settings] = await Promise.all([
    listAthletes({ status }),
    getPlans(),
    getToday(),
    getSettings(),
  ]);

  return (
    <>
      <PageHeader
        eyebrow="Gestion"
        title="Sportifs"
        description="Les sportifs sont identifiés uniquement par leur matricule. Aucune autre donnée personnelle n'est collectée."
      />
      <AthletesTable
        initial={initial.ok ? initial.data : null}
        initialStatus={status}
        openRegister={params.nouveau === "1"}
        plans={plans}
        today={today}
        defaultCurrency={settings?.default_currency ?? "XOF"}
        timezone={staff.timezone}
      />
    </>
  );
}
