import "server-only";
import { createClient } from "@/lib/supabase/server";
import { uuidSchema } from "@/lib/validation/common";
import { addDays } from "@/lib/domain/periods";
import type { AthleteStats, AttendancePoint } from "@/lib/stats-types";

export async function getAthleteDetail(id: string, today: string) {
  if (!uuidSchema.safeParse(id).success) return null;
  const supabase = await createClient();

  const { data: athlete } = await supabase.from("athlete_overview").select("*").eq("id", id).maybeSingle();
  if (!athlete) return null;

  const [stats, attendance, subscriptions, payments, visits] = await Promise.all([
    supabase.rpc("stats_athlete", { p_athlete_id: id }),
    supabase.rpc("stats_attendance", { p_from: addDays(today, -59), p_to: today, p_granularity: "day", p_athlete_id: id }),
    supabase.from("subscription_overview").select("*").eq("athlete_id", id).order("starts_on", { ascending: false }),
    supabase.from("payment_log").select("*").eq("athlete_id", id).order("paid_on", { ascending: false }).limit(50),
    supabase.from("visit_log").select("*").eq("athlete_id", id).order("entered_at", { ascending: false }).limit(30),
  ]);

  return {
    athlete,
    stats: stats.data as unknown as AthleteStats,
    attendance: (attendance.data ?? []) as AttendancePoint[],
    subscriptions: subscriptions.data ?? [],
    payments: payments.data ?? [],
    visits: visits.data ?? [],
  };
}

export type AthleteDetail = NonNullable<Awaited<ReturnType<typeof getAthleteDetail>>>;
