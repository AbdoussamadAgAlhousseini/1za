"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { signInSchema, resetRequestSchema, newPasswordSchema } from "@/lib/validation/auth";
import { fail, fromZodError } from "@/server/action-result";
import { homePathFor } from "@/server/auth";
import type { ActionResult } from "@/lib/action-types";
import { publicEnv } from "@/lib/env";

export async function signIn(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const parsed = signInSchema.safeParse({ email: formData.get("email"), password: formData.get("password") });
  if (!parsed.success) return fromZodError(parsed.error);

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword(parsed.data);

  if (error || !data.user) {
    if (error?.status === 429) return fail("Trop de tentatives de connexion. Patientez quelques minutes.");
    // Message identique quel que soit le motif : pas d'indice sur l'existence du compte.
    return fail("Adresse e-mail ou mot de passe incorrect.");
  }

  const { data: profile } = await supabase.from("profiles").select("role, is_active").eq("id", data.user.id).maybeSingle();
  if (!profile || !profile.is_active) {
    await supabase.auth.signOut();
    return fail("Ce compte n'a pas accès à l'application ou a été désactivé. Contactez l'administrateur.");
  }

  redirect(homePathFor(profile.role));
}

async function siteUrl() {
  const configured = publicEnv().NEXT_PUBLIC_SITE_URL;
  if (configured) return configured.replace(/\/$/, "");
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? "http";
  return `${proto}://${host}`;
}

export async function requestPasswordReset(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const parsed = resetRequestSchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) return fromZodError(parsed.error);

  const supabase = await createClient();
  const redirectTo = `${await siteUrl()}/auth/callback?next=/reinitialiser-mot-de-passe`;
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, { redirectTo });
  if (error?.status === 429) return fail("Trop de demandes. Patientez quelques minutes avant de réessayer.");

  // Réponse identique que le compte existe ou non (pas d'énumération des comptes).
  return {
    ok: true,
    data: undefined,
    message: "Si un compte correspond à cette adresse, un lien de réinitialisation vient d'être envoyé. Il est valable une heure.",
  };
}

export async function updatePassword(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const parsed = newPasswordSchema.safeParse({ password: formData.get("password"), confirm: formData.get("confirm") });
  if (!parsed.success) return fromZodError(parsed.error);

  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims?.sub) {
    return fail("Le lien de réinitialisation a expiré. Refaites une demande depuis la page de connexion.");
  }

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) {
    if (error.code === "same_password") return fail("Choisissez un mot de passe différent de l'actuel.");
    if (error.code === "weak_password") return fail("Ce mot de passe est trop faible.", { password: "Mot de passe trop faible." });
    return fail("Le mot de passe n'a pas pu être modifié. Refaites une demande de réinitialisation.");
  }

  const { data: profile } = await supabase.from("profiles").select("role, is_active").eq("id", claims.claims.sub).maybeSingle();
  if (!profile?.is_active) {
    await supabase.auth.signOut();
    redirect("/connexion");
  }
  redirect(`${homePathFor(profile.role)}?mot-de-passe=modifie`);
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/connexion");
}
