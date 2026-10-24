/**
 * Outils des tests d'intégration : ils s'exécutent contre une instance
 * Supabase LOCALE (`npx supabase start`) et créent des comptes et matricules
 * fictifs aléatoires. Ils refusent de s'exécuter contre une URL distante.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { randomInt, randomUUID } from "node:crypto";
import type { Database } from "@/lib/supabase/database.types";

export type Client = SupabaseClient<Database>;

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

const isLocal = /^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(url);
export const dbTestsEnabled = Boolean(url && anonKey && serviceKey && isLocal);

export const TEST_PASSWORD = "Test-Password-2026";

export function serviceClient(): Client {
  return createClient<Database>(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
}

export function anonClient(): Client {
  return createClient<Database>(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
}

export async function createStaff(role: "admin" | "agent", options: { withProfile?: boolean } = {}) {
  const service = serviceClient();
  const email = `${role}-${randomUUID().slice(0, 8)}@test.invalid`;
  const { data, error } = await service.auth.admin.createUser({ email, password: TEST_PASSWORD, email_confirm: true });
  if (error || !data.user) throw error ?? new Error("createUser");

  if (options.withProfile !== false) {
    const { error: profileError } = await service
      .from("profiles")
      .insert({
        id: data.user.id,
        role,
        display_name: `Test ${role}`,
        login_phone: role === "agent" ? `223${String(randomInt(10 ** 8)).padStart(8, "0")}` : null,
      });
    if (profileError) throw profileError;
  }

  const client = anonClient();
  const { error: signInError } = await client.auth.signInWithPassword({ email, password: TEST_PASSWORD });
  if (signInError) throw signInError;
  return { client, userId: data.user.id, email };
}

const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
export function randomMatricule(): string {
  const l = () => LETTERS[randomInt(26)];
  return `${l()}${l()}${String(randomInt(100000)).padStart(5, "0")}`;
}

export async function today(client: Client): Promise<string> {
  const { data, error } = await client.rpc("app_today");
  if (error || !data) throw error ?? new Error("app_today");
  return data;
}

export function shiftDate(iso: string, days: number): string {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Crée un sportif avec, optionnellement, un abonnement couvrant [start, end]. */
export async function createAthlete(admin: Client, sub?: { start: string; end: string }) {
  const matricule = randomMatricule();
  const { data: athleteId, error } = await admin.rpc("admin_create_athlete", { p_matricule: matricule });
  if (error || !athleteId) throw error ?? new Error("admin_create_athlete");
  let subscriptionId: string | null = null;
  if (sub) {
    const { data, error: subError } = await admin.rpc("admin_create_subscription", {
      p_athlete_id: athleteId,
      p_plan_id: null as unknown as string,
      p_starts_on: sub.start,
      p_ends_on: sub.end,
    });
    if (subError || !data) throw subError ?? new Error("admin_create_subscription");
    subscriptionId = data;
  }
  return { athleteId, matricule, subscriptionId };
}
