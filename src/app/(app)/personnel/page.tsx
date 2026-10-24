import type { Metadata } from "next";
import { requireAdmin } from "@/server/auth";
import { createClient } from "@/lib/supabase/server";
import { getToday } from "@/server/queries/common";
import { addDays } from "@/lib/domain/periods";
import { PageHeader } from "@/components/ui/page-header";
import { StaffManager, type StaffRow } from "@/components/staff/staff-manager";

export const metadata: Metadata = { title: "Personnel" };

export default async function StaffPage() {
  const staff = await requireAdmin();
  const today = await getToday();
  const supabase = await createClient();
  const [{ data: profiles }, { data: activity }] = await Promise.all([
    supabase.from("profiles").select("id, display_name, role, is_active, login_phone, created_at, deactivated_at").order("display_name"),
    supabase.rpc("stats_agents", { p_from: addDays(today, -29), p_to: today }),
  ]);

  const rows: StaffRow[] = (profiles ?? []).map((p) => {
    const a = activity?.find((x) => x.profile_id === p.id);
    return {
      ...p,
      entries_recorded: a?.entries_recorded ?? 0,
      exits_recorded: a?.exits_recorded ?? 0,
      last_activity_at: a?.last_activity_at ?? null,
    };
  });
  rows.sort((a, b) => Number(b.is_active) - Number(a.is_active) || a.display_name.localeCompare(b.display_name, "fr"));

  return (
    <>
      <PageHeader
        eyebrow="Administration"
        title="Personnel"
        description="Comptes des agents de contrôle : création, mots de passe et révocation des accès. Les révocations prennent effet immédiatement."
      />
      <StaffManager rows={rows} timezone={staff.timezone} />
    </>
  );
}
