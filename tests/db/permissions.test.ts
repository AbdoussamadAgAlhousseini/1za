import { beforeAll, describe, expect, it } from "vitest";
import {
  anonClient,
  createAthlete,
  createStaff,
  dbTestsEnabled,
  randomMatricule,
  serviceClient,
  shiftDate,
  today,
  type Client,
} from "./helpers";

/**
 * Autorisations vérifiées par appels DIRECTS à l'API (PostgREST), comme le
 * ferait un utilisateur malveillant contournant l'interface.
 */
describe.skipIf(!dbTestsEnabled)("autorisations et RLS", () => {
  let admin: Client;
  let agent: Client;
  let agentId: string;
  let athleteId: string;
  let subscriptionId: string;

  beforeAll(async () => {
    admin = (await createStaff("admin")).client;
    const a = await createStaff("agent");
    agent = a.client;
    agentId = a.userId;
    const t = await today(admin);
    const created = await createAthlete(admin, { start: shiftDate(t, -1), end: shiftDate(t, 30) });
    athleteId = created.athleteId;
    subscriptionId = created.subscriptionId!;
  });

  describe("visiteur non connecté (anon)", () => {
    it("ne lit aucune table", async () => {
      const anon = anonClient();
      for (const table of ["athletes", "subscriptions", "visits", "payments", "profiles", "audit_logs"] as const) {
        const { data, error } = await anon.from(table).select("*").limit(1);
        expect(error ?? data?.length === 0, `${table} lisible par anon`).toBeTruthy();
        if (!error) expect(data).toHaveLength(0);
      }
    });

    it("ne peut appeler aucune fonction métier", async () => {
      const anon = anonClient();
      const { error } = await anon.rpc("control_check", { p_matricule: "AB12345" });
      expect(error).not.toBeNull();
      const { error: e2 } = await anon.rpc("admin_create_athlete", { p_matricule: randomMatricule() });
      expect(e2).not.toBeNull();
    });
  });

  describe("agent de contrôle", () => {
    it("ne voit pas la liste des sportifs, abonnements, paiements ni le journal", async () => {
      for (const table of ["athletes", "subscriptions", "visits", "payments", "audit_logs"] as const) {
        const { data, error } = await agent.from(table).select("id").limit(5);
        expect(error).toBeNull();
        expect(data, table).toHaveLength(0);
      }
      const { data } = await agent.from("athlete_overview").select("id").limit(5);
      expect(data).toHaveLength(0);
    });

    it("ne voit que son propre profil", async () => {
      const { data } = await agent.from("profiles").select("id");
      expect(data?.map((p) => p.id)).toEqual([agentId]);
    });

    it("ne peut pas créer de sportif (RPC ni insertion directe)", async () => {
      const { error } = await agent.rpc("admin_create_athlete", { p_matricule: randomMatricule() });
      expect(error?.message).toBe("ERR_FORBIDDEN");
      const { error: insertError } = await agent
        .from("athletes")
        .insert({ matricule: randomMatricule(), registered_on: "2026-01-01" });
      expect(insertError).not.toBeNull();
    });

    it("ne peut pas créer, renouveler ou modifier un abonnement", async () => {
      const t = await today(agent);
      const { error } = await agent.rpc("admin_create_subscription", {
        p_athlete_id: athleteId,
        p_plan_id: null as unknown as string,
        p_starts_on: shiftDate(t, 40),
        p_ends_on: shiftDate(t, 70),
      });
      expect(error?.message).toBe("ERR_FORBIDDEN");

      const { error: stateError } = await agent.rpc("admin_set_subscription_state", {
        p_subscription_id: subscriptionId,
        p_state: "cancelled",
        p_reason: "tentative agent",
      });
      expect(stateError?.message).toBe("ERR_FORBIDDEN");

      const { error: updateError } = await agent
        .from("subscriptions")
        .update({ ends_on: "2099-12-31" })
        .eq("id", subscriptionId);
      expect(updateError).not.toBeNull();

      const { data: check } = await admin.from("subscriptions").select("ends_on").eq("id", subscriptionId).single();
      expect(check?.ends_on).not.toBe("2099-12-31");
    });

    it("ne peut pas modifier son rôle ni gérer d'autres comptes", async () => {
      const { error } = await agent.from("profiles").update({ role: "admin" }).eq("id", agentId);
      expect(error).not.toBeNull();
      const { data: role } = await agent.rpc("current_app_role");
      expect(role).toBe("agent");

      const other = await createStaff("agent");
      const { error: deactivateError } = await agent.rpc("admin_set_staff_active", {
        p_user_id: other.userId,
        p_active: false,
      });
      expect(deactivateError?.message).toBe("ERR_FORBIDDEN");
    });

    it("ne peut ni supprimer ni modifier l'historique des passages", async () => {
      await agent.rpc("control_record_entry", { p_matricule: (await createAthlete(admin, { start: await today(admin), end: await today(admin) })).matricule });
      const { error: deleteError } = await agent.from("visits").delete().neq("id", "00000000-0000-0000-0000-000000000000");
      expect(deleteError).not.toBeNull();
      const { error: updateError } = await agent.from("visits").update({ status: "cancelled" }).eq("entry_agent_id", agentId);
      expect(updateError).not.toBeNull();
      const { error: correctError } = await agent.rpc("admin_correct_visit", {
        p_visit_id: "00000000-0000-0000-0000-000000000000",
        p_action: "cancel",
        p_exited_at: null as unknown as string,
        p_reason: "tentative agent",
      });
      expect(correctError?.message).toBe("ERR_FORBIDDEN");
    });

    it("n'accède ni aux statistiques, ni aux paiements, ni aux exports", async () => {
      const { error } = await agent.rpc("stats_dashboard");
      expect(error?.message).toBe("ERR_FORBIDDEN");
      const { error: e2 } = await agent.rpc("admin_record_payment", {
        p_athlete_id: athleteId,
        p_subscription_id: subscriptionId,
        p_amount: 1000,
        p_currency: "XOF",
        p_paid_on: await today(agent),
        p_method: "cash",
      });
      expect(e2?.message).toBe("ERR_FORBIDDEN");
      const { error: e3 } = await agent.rpc("admin_log_export", { p_kind: "visits", p_params: {} });
      expect(e3?.message).toBe("ERR_FORBIDDEN");
    });

    it("peut vérifier un matricule sans obtenir d'identifiant interne", async () => {
      const { data: athlete } = await admin.from("athletes").select("matricule").eq("id", athleteId).single();
      const { data, error } = await agent.rpc("control_check", { p_matricule: athlete!.matricule });
      expect(error).toBeNull();
      const result = data as Record<string, unknown>;
      expect(result.outcome).toBe("authorized");
      expect(JSON.stringify(result)).not.toContain(athleteId);
    });
  });

  describe("compte sans profil ou désactivé", () => {
    it("un utilisateur authentifié sans profil n'a aucun accès", async () => {
      const { client } = await createStaff("agent", { withProfile: false });
      const { error } = await client.rpc("control_check", { p_matricule: "AB12345" });
      expect(error?.message).toBe("ERR_FORBIDDEN");
      const { data } = await client.from("app_settings").select("*");
      expect(data).toHaveLength(0);
    });

    it("un agent désactivé perd immédiatement ses accès, son historique est conservé", async () => {
      const victim = await createStaff("agent");
      const t = await today(admin);
      const { matricule } = await createAthlete(admin, { start: t, end: t });
      const entry = await victim.client.rpc("control_record_entry", { p_matricule: matricule });
      expect(entry.error).toBeNull();

      const { error } = await admin.rpc("admin_set_staff_active", { p_user_id: victim.userId, p_active: false });
      expect(error).toBeNull();

      const { error: afterError } = await victim.client.rpc("control_check", { p_matricule: matricule });
      expect(afterError?.message).toBe("ERR_FORBIDDEN");

      const { data: visits } = await admin.from("visits").select("id").eq("entry_agent_id", victim.userId);
      expect(visits).toHaveLength(1);
    });
  });

  describe("administrateur", () => {
    it("ne peut pas se désactiver lui-même", async () => {
      const self = await createStaff("admin");
      const { error } = await self.client.rpc("admin_set_staff_active", { p_user_id: self.userId, p_active: false });
      expect(error?.message).toBe("ERR_SELF_ACTION");
    });

    it("ne peut ni modifier ni supprimer le journal d'audit", async () => {
      const { data: logs } = await admin.from("audit_logs").select("id").limit(1);
      expect(logs?.length).toBe(1);
      const id = logs![0]!.id;
      const { error: u } = await admin.from("audit_logs").update({ action: "x.y" }).eq("id", id);
      expect(u).not.toBeNull();
      const { error: d } = await admin.from("audit_logs").delete().eq("id", id);
      expect(d).not.toBeNull();
    });

    it("ne peut pas modifier un matricule, même avec la clé service_role", async () => {
      const { error } = await serviceClient().from("athletes").update({ matricule: randomMatricule() }).eq("id", athleteId);
      expect(error?.message).toBe("ERR_IMMUTABLE");
    });

    it("aucune suppression physique de l'historique, même avec la clé service_role", async () => {
      const { error } = await serviceClient().from("subscriptions").delete().eq("id", subscriptionId);
      expect(error?.message).toBe("ERR_IMMUTABLE");
    });
  });

  describe("limitation de débit", () => {
    it("bloque les vérifications abusives d'un même agent", async () => {
      const { client } = await createStaff("agent");
      let limited = false;
      for (let i = 0; i < 130 && !limited; i++) {
        const { error } = await client.rpc("control_check", { p_matricule: randomMatricule() });
        if (error?.message === "ERR_RATE_LIMITED") limited = true;
      }
      expect(limited).toBe(true);
    });
  });
});
