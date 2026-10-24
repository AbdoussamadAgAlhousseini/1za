import type { Metadata } from "next";
import { requireAdmin } from "@/server/auth";
import { createClient } from "@/lib/supabase/server";
import { listVisits } from "@/server/actions/lists";
import { uuidSchema } from "@/lib/validation/common";
import { PageHeader } from "@/components/ui/page-header";
import { VisitsTable } from "@/components/visits/visits-table";

export const metadata: Metadata = { title: "Fréquentation" };

export default async function AttendancePage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const staff = await requireAdmin();
  const params = await searchParams;
  // L'identifiant interne (UUID) peut figurer dans l'URL ; jamais le matricule.
  const athleteId = uuidSchema.safeParse(params.sportif).success ? (params.sportif as string) : "";
  const status: "all" | "open" | "closed" | "cancelled" = ["open", "closed", "cancelled"].includes(params.statut ?? "") ? (params.statut as "open" | "closed" | "cancelled") : "all";
  const initialFilters = { search: "", athleteId, status, agentId: "", from: "", to: "", page: 1 };

  const supabase = await createClient();
  const [initial, { data: agents }, athlete] = await Promise.all([
    listVisits(initialFilters),
    supabase.from("profiles").select("id, display_name").order("display_name"),
    athleteId ? supabase.from("athletes").select("matricule").eq("id", athleteId).maybeSingle() : Promise.resolve({ data: null }),
  ]);

  return (
    <>
      <PageHeader
        eyebrow="Gestion"
        title="Fréquentation"
        description="Historique des entrées et sorties, horodatées par le serveur. Les corrections exceptionnelles exigent un motif et sont journalisées."
      />
      <VisitsTable
        initial={initial.ok ? initial.data : null}
        initialFilters={initialFilters}
        agents={agents ?? []}
        timezone={staff.timezone}
        athleteLabel={athlete.data?.matricule ?? null}
      />
    </>
  );
}
