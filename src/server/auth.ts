import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { AppRole } from "@/lib/domain/status";
import { DEFAULT_TIMEZONE } from "@/lib/domain/format";

export interface StaffSession {
  userId: string;
  email: string | null;
  role: AppRole;
  displayName: string;
  stadiumName: string;
  timezone: string;
}

type SessionLookup =
  | { status: "anonymous" }
  | { status: "no_access" }
  | { status: "ok"; staff: StaffSession };

/**
 * Lit la session (JWT vérifié) puis le profil du personnel. Mis en cache pour
 * la durée d'une requête. Un compte sans profil ou désactivé n'a aucun accès.
 */
export const getSessionLookup = cache(async (): Promise<SessionLookup> => {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const claims = claimsData?.claims;
  if (!claims?.sub) return { status: "anonymous" };

  const [{ data: profile }, { data: settings }] = await Promise.all([
    supabase.from("profiles").select("role, display_name, is_active").eq("id", claims.sub).maybeSingle(),
    supabase.from("app_settings").select("stadium_name, timezone").maybeSingle(),
  ]);

  if (!profile || !profile.is_active) return { status: "no_access" };

  return {
    status: "ok",
    staff: {
      userId: claims.sub,
      email: typeof claims.email === "string" ? claims.email : null,
      role: profile.role,
      displayName: profile.display_name,
      stadiumName: settings?.stadium_name ?? "Stade du 26 Mars",
      timezone: settings?.timezone ?? DEFAULT_TIMEZONE,
    },
  };
});

export function homePathFor(role: AppRole) {
  return role === "admin" ? "/tableau-de-bord" : "/controle";
}

/** Exige un membre du personnel actif (administrateur ou agent). */
export async function requireStaff(): Promise<StaffSession> {
  const lookup = await getSessionLookup();
  if (lookup.status === "anonymous") redirect("/connexion");
  if (lookup.status === "no_access") redirect("/acces-suspendu");
  return lookup.staff;
}

/** Exige un administrateur actif. Les agents sont redirigés vers une page explicite. */
export async function requireAdmin(): Promise<StaffSession> {
  const staff = await requireStaff();
  if (staff.role !== "admin") redirect("/acces-refuse");
  return staff;
}
