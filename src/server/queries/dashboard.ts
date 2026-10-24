import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { AttendancePoint, DashboardStats } from "@/lib/stats-types";
import { addDays } from "@/lib/domain/periods";

export async function getDashboardData() {
  const supabase = await createClient();
  const { data: statsRaw, error } = await supabase.rpc("stats_dashboard");
  if (error || !statsRaw) throw new Error("stats_dashboard");
  const stats = statsRaw as unknown as DashboardStats;
  const today = stats.today;

  const [attendance, expiring, expired, recent, offlineIssues] = await Promise.all([
    supabase.rpc("stats_attendance", { p_from: addDays(today, -29), p_to: today, p_granularity: "day" }),
    supabase
      .from("athlete_overview")
      .select("id, matricule, ends_on, days_remaining, plan_name")
      .eq("expiring_soon", true)
      .order("ends_on", { ascending: true })
      .limit(6),
    supabase
      .from("athlete_overview")
      .select("id, matricule, ends_on, days_remaining, plan_name")
      .eq("status", "expired")
      .gte("ends_on", addDays(today, -30))
      .order("ends_on", { ascending: false })
      .limit(5),
    supabase
      .from("visit_log")
      .select("id, athlete_id, matricule, entered_at, exited_at, status, duration_seconds, entry_agent_name")
      .neq("status", "cancelled")
      .order("entered_at", { ascending: false })
      .limit(8),
    supabase.from("offline_operations").select("id", { count: "exact", head: true }).neq("result", "applied").is("reviewed_at", null),
  ]);

  return {
    stats,
    attendance: (attendance.data ?? []) as AttendancePoint[],
    expiring: expiring.data ?? [],
    expired: expired.data ?? [],
    recent: recent.data ?? [],
    offlineIssues: offlineIssues.count ?? 0,
  };
}
