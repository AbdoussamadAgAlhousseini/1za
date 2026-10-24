import { beforeAll, describe, expect, it } from "vitest";
import { createAthlete, createStaff, dbTestsEnabled, serviceClient, today, type Client } from "./helpers";

describe.skipIf(!dbTestsEnabled)("suppressions administratives", () => {
  let admin: Client;
  let agent: Client;
  let t: string;

  beforeAll(async () => {
    admin = (await createStaff("admin")).client;
    agent = (await createStaff("agent")).client;
    t = await today(admin);
  });

  describe("sportif", () => {
    it("efface le sportif et toutes ses données, avec trace dans le journal", async () => {
      const { athleteId, matricule, subscriptionId } = await createAthlete(admin, { start: t, end: t });
      await admin.rpc("admin_record_payment", {
        p_athlete_id: athleteId,
        p_subscription_id: subscriptionId!,
        p_amount: 1000,
        p_currency: "XOF",
        p_paid_on: t,
        p_method: "cash",
      });
      await agent.rpc("control_record_entry", { p_matricule: matricule });
      await agent.rpc("control_record_exit", { p_matricule: matricule });

      const { data, error } = await admin.rpc("admin_delete_athlete", {
        p_athlete_id: athleteId,
        p_matricule_confirmation: matricule.toLowerCase(),
        p_reason: "Demande d'effacement",
      });
      expect(error).toBeNull();
      expect(data).toEqual({ subscriptions: 1, payments: 1, visits: 1 });

      const { count: athletesLeft } = await admin.from("athletes").select("*", { count: "exact", head: true }).eq("id", athleteId);
      expect(athletesLeft).toBe(0);
      for (const table of ["subscriptions", "payments", "visits"] as const) {
        const { count } = await admin.from(table).select("*", { count: "exact", head: true }).eq("athlete_id", athleteId);
        expect(count, table).toBe(0);
      }
      const { data: logs } = await admin.from("audit_logs").select("action, details").eq("entity_id", athleteId).eq("action", "athlete.deleted");
      expect(logs).toHaveLength(1);
      expect(JSON.stringify(logs)).not.toContain(matricule);
      // Le matricule redevient disponible.
      expect((await admin.rpc("admin_create_athlete", { p_matricule: matricule })).error).toBeNull();
    });

    it("exige le matricule exact et un motif", async () => {
      const { athleteId, matricule } = await createAthlete(admin);
      expect(
        (await admin.rpc("admin_delete_athlete", { p_athlete_id: athleteId, p_matricule_confirmation: "ZZ00000", p_reason: "Erreur de saisie" })).error
          ?.message,
      ).toBe("ERR_CONFIRMATION_MISMATCH");
      expect(
        (await admin.rpc("admin_delete_athlete", { p_athlete_id: athleteId, p_matricule_confirmation: matricule, p_reason: "" })).error?.message,
      ).toBe("ERR_REASON_REQUIRED");
    });

    it("interdit aux agents, et l'historique reste protégé hors de cette fonction", async () => {
      const { athleteId, matricule } = await createAthlete(admin, { start: t, end: t });
      expect(
        (await agent.rpc("admin_delete_athlete", { p_athlete_id: athleteId, p_matricule_confirmation: matricule, p_reason: "Tentative agent" })).error
          ?.message,
      ).toBe("ERR_FORBIDDEN");
      const { error } = await serviceClient().from("athletes").delete().eq("id", athleteId);
      expect(error?.message).toBe("ERR_IMMUTABLE");
    });
  });

  describe("agent", () => {
    it("archive le profil, libère le numéro et conserve l'historique", async () => {
      const victim = await createStaff("agent");
      const { matricule } = await createAthlete(admin, { start: t, end: t });
      await victim.client.rpc("control_record_entry", { p_matricule: matricule });
      const { data: before } = await admin.from("profiles").select("login_phone").eq("id", victim.userId).single();

      expect((await admin.rpc("admin_delete_agent", { p_user_id: victim.userId, p_reason: "Fin de contrat" })).error).toBeNull();
      // Suppression du compte d'authentification (fait par le serveur avec la clé service_role).
      expect((await serviceClient().auth.admin.deleteUser(victim.userId)).error).toBeNull();

      const { data: profile } = await admin.from("profiles").select("is_active, deleted_at, login_phone, display_name").eq("id", victim.userId).single();
      expect(profile).toMatchObject({ is_active: false, login_phone: null });
      expect(profile?.deleted_at).not.toBeNull();

      const { data: visits } = await admin.from("visit_log").select("entry_agent_name").eq("entry_agent_id", victim.userId);
      expect(visits?.[0]?.entry_agent_name).toBe(profile?.display_name);

      // Le numéro peut servir à un nouveau compte.
      const fresh = await serviceClient().auth.admin.createUser({ email: `n.${Date.now()}@stade26.invalid`, password: "Test-Password-2026", email_confirm: true });
      expect(
        (await admin.rpc("admin_register_agent", { p_user_id: fresh.data.user!.id, p_display_name: "Nouvel agent", p_login_phone: before!.login_phone! })).error,
      ).toBeNull();

      // Un compte supprimé ne peut pas être réactivé.
      expect((await admin.rpc("admin_set_staff_active", { p_user_id: victim.userId, p_active: true })).error?.message).toBe("ERR_USER_NOT_FOUND");
    });

    it("interdit aux agents, impossible sur soi-même ou sur un administrateur", async () => {
      const other = await createStaff("agent");
      expect((await agent.rpc("admin_delete_agent", { p_user_id: other.userId, p_reason: "Tentative agent" })).error?.message).toBe("ERR_FORBIDDEN");
      const self = await createStaff("admin");
      expect((await self.client.rpc("admin_delete_agent", { p_user_id: self.userId, p_reason: "Auto-suppression" })).error?.message).toBe("ERR_SELF_ACTION");
      const otherAdmin = await createStaff("admin");
      expect((await admin.rpc("admin_delete_agent", { p_user_id: otherAdmin.userId, p_reason: "Suppression admin" })).error?.message).toBe("ERR_USER_NOT_FOUND");
    });
  });
});
