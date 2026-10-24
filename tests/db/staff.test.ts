import { beforeAll, describe, expect, it } from "vitest";
import { randomInt } from "node:crypto";
import { anonClient, createStaff, dbTestsEnabled, serviceClient, TEST_PASSWORD, today, type Client } from "./helpers";

function randomPhone() {
  return `223${String(randomInt(10 ** 8)).padStart(8, "0")}`;
}

async function createAuthUser(email: string) {
  const { data, error } = await serviceClient().auth.admin.createUser({ email, password: TEST_PASSWORD, email_confirm: true });
  if (error || !data.user) throw error ?? new Error("createUser");
  return data.user.id;
}

describe.skipIf(!dbTestsEnabled)("personnel et connexion par téléphone", () => {
  let admin: Client;
  let agent: Client;

  beforeAll(async () => {
    admin = (await createStaff("admin")).client;
    agent = (await createStaff("agent")).client;
  });

  it("l'administrateur enregistre un agent avec son numéro (journalisé, sans le numéro)", async () => {
    const phone = randomPhone();
    const userId = await createAuthUser(`agent.${phone}@stade26.invalid`);
    const { error } = await admin.rpc("admin_register_agent", { p_user_id: userId, p_display_name: "Agent Phone", p_login_phone: phone });
    expect(error).toBeNull();

    const { data: profile } = await admin.from("profiles").select("role, login_phone").eq("id", userId).single();
    expect(profile).toEqual({ role: "agent", login_phone: phone });

    const { data: logs } = await admin.from("audit_log_view").select("action, details, target_staff_name").eq("entity_id", userId);
    expect(logs?.[0]?.action).toBe("staff.created");
    expect(logs?.[0]?.target_staff_name).toBe("Agent Phone");
    expect(JSON.stringify(logs?.[0]?.details)).not.toContain(phone);

    // Connexion avec l'identifiant technique dérivé du numéro.
    const client = anonClient();
    const { error: signInError } = await client.auth.signInWithPassword({ email: `agent.${phone}@stade26.invalid`, password: TEST_PASSWORD });
    expect(signInError).toBeNull();
    const { data: role } = await client.rpc("current_app_role");
    expect(role).toBe("agent");
  });

  it("refuse un numéro déjà utilisé ou mal formé", async () => {
    const phone = randomPhone();
    const first = await createAuthUser(`agent.${phone}@stade26.invalid`);
    await admin.rpc("admin_register_agent", { p_user_id: first, p_display_name: "Premier", p_login_phone: phone });
    const second = await createAuthUser(`autre.${phone}@stade26.invalid`);
    const dup = await admin.rpc("admin_register_agent", { p_user_id: second, p_display_name: "Second", p_login_phone: phone });
    expect(dup.error?.message).toBe("ERR_PHONE_DUPLICATE");
    const bad = await admin.rpc("admin_register_agent", { p_user_id: second, p_display_name: "Second", p_login_phone: "12-34" });
    expect(bad.error?.message).toBe("ERR_INVALID_INPUT");
  });

  it("un agent ne peut ni créer de compte, ni renommer, ni consulter les journaux de mot de passe", async () => {
    const userId = await createAuthUser(`x.${randomPhone()}@stade26.invalid`);
    expect((await agent.rpc("admin_register_agent", { p_user_id: userId, p_display_name: "Pirate", p_login_phone: randomPhone() })).error?.message).toBe("ERR_FORBIDDEN");
    expect((await agent.rpc("admin_update_agent", { p_user_id: userId, p_display_name: "Pirate" })).error?.message).toBe("ERR_FORBIDDEN");
    expect((await agent.rpc("admin_log_agent_password_reset", { p_user_id: userId })).error?.message).toBe("ERR_FORBIDDEN");
  });

  it("un agent doit avoir un numéro de connexion (contrainte)", async () => {
    const userId = await createAuthUser(`sansnum.${randomPhone()}@stade26.invalid`);
    const { error } = await serviceClient().from("profiles").insert({ id: userId, role: "agent", display_name: "Sans numéro" });
    expect(error?.code).toBe("23514");
  });

  it("chaque utilisateur journalise le changement de son propre mot de passe", async () => {
    expect((await agent.rpc("log_own_password_change")).error).toBeNull();
    expect((await anonClient().rpc("log_own_password_change")).error).not.toBeNull();
  });

  it("synthèse de période réservée à l'administrateur", async () => {
    const t = await today(admin);
    const { data, error } = await admin.rpc("stats_period_summary", { p_from: t, p_to: t });
    expect(error).toBeNull();
    expect(data).toHaveProperty("unique_athletes");
    expect((await agent.rpc("stats_period_summary", { p_from: t, p_to: t })).error?.message).toBe("ERR_FORBIDDEN");
  });
});
