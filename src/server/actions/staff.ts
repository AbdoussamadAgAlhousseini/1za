"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { reasonSchema, uuidSchema } from "@/lib/validation/common";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/server/auth";
import { fail, fromDbError, fromZodError } from "@/server/action-result";
import type { ActionResult } from "@/lib/action-types";
import { agentLoginEmail } from "@/lib/auth/identity";
import { ERROR_MESSAGES } from "@/lib/domain/errors";
import { createAgentSchema, renameAgentSchema, resetAgentPasswordSchema, setAgentActiveSchema } from "@/lib/validation/staff";

/** Bannissement « illimité » côté Supabase Auth (≈ 100 ans). */
const BAN_FOREVER = "876000h";

async function assertAgent(userId: string) {
  const supabase = await createClient();
  const { data } = await supabase.from("profiles").select("id, role, deleted_at").eq("id", userId).maybeSingle();
  return data?.role === "agent" && !data.deleted_at;
}

export async function createAgent(input: { displayName: string; phone: string; password: string }): Promise<ActionResult<{ userId: string }>> {
  await requireAdmin();
  const parsed = createAgentSchema.safeParse(input);
  if (!parsed.success) return fromZodError(parsed.error);
  const { displayName, phone, password } = parsed.data;

  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.createUser({
    email: agentLoginEmail(phone),
    password,
    email_confirm: true,
  });
  if (error || !data.user) {
    if (error?.code === "email_exists" || /already/i.test(error?.message ?? "")) {
      return fail(ERROR_MESSAGES.ERR_PHONE_DUPLICATE, { phone: ERROR_MESSAGES.ERR_PHONE_DUPLICATE });
    }
    if (error?.code === "weak_password") return fail("Mot de passe trop faible.", { password: "Mot de passe trop faible." });
    console.error("[create_agent] création du compte impossible");
    return fail("Le compte n'a pas pu être créé. Réessayez.");
  }

  // Profil créé avec la session de l'administrateur : contrôle du rôle et journalisation en base.
  const supabase = await createClient();
  const { error: rpcError } = await supabase.rpc("admin_register_agent", {
    p_user_id: data.user.id,
    p_display_name: displayName,
    p_login_phone: phone,
  });
  if (rpcError) {
    await admin.auth.admin.deleteUser(data.user.id);
    const res = fromDbError(rpcError, "admin_register_agent");
    if (!res.ok && res.code === "ERR_PHONE_DUPLICATE") return { ...res, fieldErrors: { phone: res.message } };
    return res;
  }

  revalidatePath("/personnel");
  return { ok: true, data: { userId: data.user.id }, message: `Compte de ${displayName} créé.` };
}

export async function resetAgentPassword(input: { userId: string; password: string }): Promise<ActionResult> {
  await requireAdmin();
  const parsed = resetAgentPasswordSchema.safeParse(input);
  if (!parsed.success) return fromZodError(parsed.error);
  if (!(await assertAgent(parsed.data.userId))) return fail(ERROR_MESSAGES.ERR_USER_NOT_FOUND);

  const { error } = await createAdminClient().auth.admin.updateUserById(parsed.data.userId, { password: parsed.data.password });
  if (error) {
    if (error.code === "weak_password") return fail("Mot de passe trop faible.", { password: "Mot de passe trop faible." });
    return fail("Le mot de passe n'a pas pu être modifié. Réessayez.");
  }
  const supabase = await createClient();
  await supabase.rpc("admin_log_agent_password_reset", { p_user_id: parsed.data.userId });
  return { ok: true, data: undefined, message: "Nouveau mot de passe enregistré. Communiquez-le à l'agent en main propre." };
}

export async function setAgentActive(input: { userId: string; active: boolean }): Promise<ActionResult> {
  await requireAdmin();
  const parsed = setAgentActiveSchema.safeParse(input);
  if (!parsed.success) return fromZodError(parsed.error);
  if (!(await assertAgent(parsed.data.userId))) return fail(ERROR_MESSAGES.ERR_USER_NOT_FOUND);

  // 1. Base de données : effet immédiat sur toutes les autorisations (RLS + fonctions).
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_set_staff_active", { p_user_id: parsed.data.userId, p_active: parsed.data.active });
  if (error) return fromDbError(error, "admin_set_staff_active");

  // 2. Authentification : empêche toute nouvelle connexion / tout rafraîchissement de session.
  const { error: banError } = await createAdminClient().auth.admin.updateUserById(parsed.data.userId, {
    ban_duration: parsed.data.active ? "none" : BAN_FOREVER,
  });
  if (banError) console.error("[set_agent_active] mise à jour du bannissement impossible");

  revalidatePath("/personnel");
  return {
    ok: true,
    data: undefined,
    message: parsed.data.active ? "Accès de l'agent rétabli." : "Accès de l'agent révoqué. Son historique est conservé.",
  };
}

export async function renameAgent(input: { userId: string; displayName: string }): Promise<ActionResult> {
  await requireAdmin();
  const parsed = renameAgentSchema.safeParse(input);
  if (!parsed.success) return fromZodError(parsed.error);
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_update_agent", { p_user_id: parsed.data.userId, p_display_name: parsed.data.displayName });
  if (error) return fromDbError(error, "admin_update_agent");
  revalidatePath("/personnel");
  return { ok: true, data: undefined, message: "Nom mis à jour." };
}

export async function deleteAgent(input: { userId: string; reason: string }): Promise<ActionResult> {
  await requireAdmin();
  const parsed = z.object({ userId: uuidSchema, reason: reasonSchema }).safeParse(input);
  if (!parsed.success) return fromZodError(parsed.error);
  if (!(await assertAgent(parsed.data.userId))) return fail(ERROR_MESSAGES.ERR_USER_NOT_FOUND);

  // 1. Base : profil archivé (accès coupé immédiatement, numéro libéré, historique conservé).
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_delete_agent", { p_user_id: parsed.data.userId, p_reason: parsed.data.reason });
  if (error) return fromDbError(error, "admin_delete_agent");

  // 2. Authentification : suppression définitive du compte de connexion.
  const { error: authError } = await createAdminClient().auth.admin.deleteUser(parsed.data.userId);
  if (authError) {
    // Le profil est déjà désactivé : aucun accès possible. On bloque aussi la connexion.
    await createAdminClient().auth.admin.updateUserById(parsed.data.userId, { ban_duration: BAN_FOREVER });
    console.error("[delete_agent] suppression du compte d'authentification impossible");
  }

  revalidatePath("/personnel");
  return { ok: true, data: undefined, message: "Compte supprimé. Son historique est conservé et son numéro peut être réutilisé." };
}
