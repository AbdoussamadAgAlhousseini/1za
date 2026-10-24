"use server";

import { redirect } from "next/navigation";
import { createClient as createPlainClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { publicEnv } from "@/lib/env";
import {
  adminPasswordSchema,
  adminSignInSchema,
  agentSignInSchema,
  changePasswordSchema,
  passwordSchema,
} from "@/lib/validation/auth";
import { ADMIN_LOGIN_EMAIL, agentLoginEmail } from "@/lib/auth/identity";
import { fail, fromZodError } from "@/server/action-result";
import { homePathFor, requireStaff } from "@/server/auth";
import type { ActionResult } from "@/lib/action-types";

const INVALID_CREDENTIALS = "Identifiants incorrects. Vérifiez la saisie et réessayez.";

export async function signIn(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const mode = formData.get("mode") === "admin" ? "admin" : "agent";

  let email: string;
  let password: string;
  if (mode === "admin") {
    const parsed = adminSignInSchema.safeParse({ password: formData.get("password") });
    if (!parsed.success) return fromZodError(parsed.error);
    email = ADMIN_LOGIN_EMAIL;
    password = parsed.data.password;
  } else {
    const parsed = agentSignInSchema.safeParse({ phone: formData.get("phone"), password: formData.get("password") });
    if (!parsed.success) return fromZodError(parsed.error);
    email = agentLoginEmail(parsed.data.phone);
    password = parsed.data.password;
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error || !data.user) {
    if (error?.status === 429) return fail("Trop de tentatives de connexion. Patientez quelques minutes avant de réessayer.");
    if (error?.code === "user_banned") return fail("Ce compte a été désactivé. Contactez l'administrateur.");
    // Message identique quel que soit le motif : pas d'indice sur l'existence du compte.
    return fail(INVALID_CREDENTIALS);
  }

  const { data: profile } = await supabase.from("profiles").select("role, is_active").eq("id", data.user.id).maybeSingle();
  const expectedRole = mode === "admin" ? "admin" : "agent";
  if (!profile || !profile.is_active || profile.role !== expectedRole) {
    await supabase.auth.signOut();
    return fail(
      profile && !profile.is_active
        ? "Ce compte a été désactivé. Contactez l'administrateur."
        : INVALID_CREDENTIALS,
    );
  }

  redirect(homePathFor(profile.role));
}

export async function changeOwnPassword(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const staff = await requireStaff();
  const parsed = changePasswordSchema.safeParse({
    current: formData.get("current"),
    password: formData.get("password"),
    confirm: formData.get("confirm"),
  });
  if (!parsed.success) return fromZodError(parsed.error);

  const policy = (staff.role === "admin" ? adminPasswordSchema : passwordSchema).safeParse(parsed.data.password);
  if (!policy.success) return fail("Le nouveau mot de passe ne respecte pas les règles.", { password: policy.error.issues[0]?.message ?? "" });

  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const email = typeof claims?.claims?.email === "string" ? claims.claims.email : null;
  if (!email) return fail("Session expirée. Reconnectez-vous.");

  // Vérification du mot de passe actuel sur un client isolé (sans cookies).
  const env = publicEnv();
  const verifier = createPlainClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error: verifyError } = await verifier.auth.signInWithPassword({ email, password: parsed.data.current });
  if (verifyError) {
    if (verifyError.status === 429) return fail("Trop de tentatives. Patientez quelques minutes.");
    return fail("Le mot de passe actuel est incorrect.", { current: "Mot de passe actuel incorrect." });
  }
  // Portée « local » : ne révoque que la session de vérification, pas celle de l'utilisateur.
  await verifier.auth.signOut({ scope: "local" });

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) {
    if (error.code === "weak_password") return fail("Ce mot de passe est trop faible.", { password: "Mot de passe trop faible." });
    return fail("Le mot de passe n'a pas pu être modifié. Réessayez.");
  }
  await supabase.rpc("log_own_password_change");

  return { ok: true, data: undefined, message: "Mot de passe modifié. Utilisez-le dès votre prochaine connexion." };
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/connexion");
}
