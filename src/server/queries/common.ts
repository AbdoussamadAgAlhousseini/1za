import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

/** Date du jour dans le fuseau du stade (source unique : PostgreSQL). */
export const getToday = cache(async (): Promise<string> => {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("app_today");
  if (error || !data) throw new Error("app_today");
  return data;
});

export const getSettings = cache(async () => {
  const supabase = await createClient();
  const { data } = await supabase.from("app_settings").select("*").maybeSingle();
  return data;
});

export interface PlanOption {
  id: string;
  name: string;
  duration_days: number;
  price: number | null;
  currency: string;
  is_active: boolean;
}

export const getPlans = cache(async (): Promise<PlanOption[]> => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("subscription_plans")
    .select("id, name, duration_days, price, currency, is_active")
    .order("duration_days", { ascending: true });
  return data ?? [];
});
