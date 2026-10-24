import { beforeAll, describe, expect, it } from "vitest";
import { createAthlete, createStaff, dbTestsEnabled, serviceClient, shiftDate, today, type Client } from "./helpers";

interface CheckResult {
  outcome: string;
  matricule: string;
  subscription: { ends_on: string; days_remaining: number } | null;
  open_visit: { entered_at: string } | null;
}

describe.skipIf(!dbTestsEnabled)("contrôle des entrées et sorties", () => {
  let admin: Client;
  let agent: Client;
  let agentId: string;
  let t: string;

  beforeAll(async () => {
    admin = (await createStaff("admin")).client;
    const a = await createStaff("agent");
    agent = a.client;
    agentId = a.userId;
    t = await today(admin);
  });

  async function check(matricule: string) {
    const { data, error } = await agent.rpc("control_check", { p_matricule: matricule });
    expect(error).toBeNull();
    return data as unknown as CheckResult;
  }

  it.each([
    { label: "abonnement valide", sub: { start: -1, end: 10 }, outcome: "authorized" },
    { label: "abonnement expiré", sub: { start: -30, end: -1 }, outcome: "expired" },
    { label: "abonnement pas encore valide", sub: { start: 2, end: 30 }, outcome: "upcoming" },
    { label: "aucun abonnement", sub: null, outcome: "no_subscription" },
  ])("vérification : $label", async ({ sub, outcome }) => {
    const { matricule } = await createAthlete(
      admin,
      sub ? { start: shiftDate(t, sub.start), end: shiftDate(t, sub.end) } : undefined,
    );
    expect((await check(matricule.toLowerCase())).outcome).toBe(outcome);
  });

  it("matricule inconnu ou mal formé", async () => {
    expect((await check("ZZ00000")).outcome).toMatch(/not_found|authorized|expired|upcoming|no_subscription/);
    expect((await check("12345")).outcome).toBe("invalid_format");
  });

  it("enregistre l'entrée avec horodatage serveur et agent, puis la sortie avec la durée", async () => {
    const { matricule, athleteId } = await createAthlete(admin, { start: t, end: shiftDate(t, 5) });
    const before = Date.now();
    const entry = await agent.rpc("control_record_entry", { p_matricule: matricule });
    expect(entry.error).toBeNull();

    const inside = await check(matricule);
    expect(inside.outcome).toBe("already_inside");
    expect(inside.open_visit).not.toBeNull();

    const exit = await agent.rpc("control_record_exit", { p_matricule: matricule });
    expect(exit.error).toBeNull();
    const exitData = exit.data as { duration_seconds: number };
    expect(exitData.duration_seconds).toBeGreaterThanOrEqual(0);

    const { data: visit } = await admin.from("visits").select("*").eq("athlete_id", athleteId).single();
    expect(visit?.status).toBe("closed");
    expect(visit?.entry_agent_id).toBe(agentId);
    expect(visit?.exit_agent_id).toBe(agentId);
    expect(Math.abs(new Date(visit!.entered_at).getTime() - before)).toBeLessThan(60_000);
    expect(visit?.duration_seconds).toBe(
      Math.floor((new Date(visit!.exited_at!).getTime() - new Date(visit!.entered_at).getTime()) / 1000),
    );
  });

  it("refuse une double entrée", async () => {
    const { matricule } = await createAthlete(admin, { start: t, end: t });
    expect((await agent.rpc("control_record_entry", { p_matricule: matricule })).error).toBeNull();
    const second = await agent.rpc("control_record_entry", { p_matricule: matricule });
    expect(second.error?.message).toBe("ERR_ALREADY_INSIDE");
  });

  it("une seule entrée réussit en cas d'enregistrements simultanés", async () => {
    const { matricule, athleteId } = await createAthlete(admin, { start: t, end: t });
    const otherAgent = (await createStaff("agent")).client;
    const results = await Promise.all([
      agent.rpc("control_record_entry", { p_matricule: matricule }),
      otherAgent.rpc("control_record_entry", { p_matricule: matricule }),
      agent.rpc("control_record_entry", { p_matricule: matricule }),
      otherAgent.rpc("control_record_entry", { p_matricule: matricule }),
    ]);
    expect(results.filter((r) => r.error === null)).toHaveLength(1);
    expect(results.filter((r) => r.error?.message === "ERR_ALREADY_INSIDE")).toHaveLength(3);
    const { count } = await admin.from("visits").select("id", { count: "exact", head: true }).eq("athlete_id", athleteId);
    expect(count).toBe(1);
  });

  it("refuse une double sortie et une sortie sans entrée", async () => {
    const { matricule } = await createAthlete(admin, { start: t, end: t });
    const noEntry = await agent.rpc("control_record_exit", { p_matricule: matricule });
    expect(noEntry.error?.message).toBe("ERR_NO_OPEN_VISIT");

    await agent.rpc("control_record_entry", { p_matricule: matricule });
    const exits = await Promise.all([
      agent.rpc("control_record_exit", { p_matricule: matricule }),
      agent.rpc("control_record_exit", { p_matricule: matricule }),
    ]);
    expect(exits.filter((r) => r.error === null)).toHaveLength(1);
    expect(exits.filter((r) => r.error?.message === "ERR_NO_OPEN_VISIT")).toHaveLength(1);
  });

  it("refuse l'entrée d'un abonnement expiré, suspendu ou inconnu", async () => {
    const expired = await createAthlete(admin, { start: shiftDate(t, -10), end: shiftDate(t, -1) });
    expect((await agent.rpc("control_record_entry", { p_matricule: expired.matricule })).error?.message).toBe(
      "ERR_SUBSCRIPTION_INVALID",
    );

    const suspended = await createAthlete(admin, { start: t, end: shiftDate(t, 10) });
    await admin.rpc("admin_set_subscription_state", {
      p_subscription_id: suspended.subscriptionId!,
      p_state: "suspended",
      p_reason: "Suspension test",
    });
    expect((await check(suspended.matricule)).outcome).toBe("suspended");
    expect((await agent.rpc("control_record_entry", { p_matricule: suspended.matricule })).error?.message).toBe(
      "ERR_SUBSCRIPTION_INVALID",
    );

    const unknown = await agent.rpc("control_record_entry", { p_matricule: "QQ99999" });
    expect(["ERR_ATHLETE_NOT_FOUND", null]).toContain(unknown.error?.message ?? null);
  });

  it("l'agent ne peut pas falsifier l'heure d'entrée", async () => {
    const { matricule, athleteId } = await createAthlete(admin, { start: t, end: t });
    await agent.rpc("control_record_entry", { p_matricule: matricule });
    const { data: visit } = await admin.from("visits").select("id").eq("athlete_id", athleteId).single();
    const { error } = await serviceClient().from("visits").update({ entered_at: "2020-01-01T00:00:00Z" }).eq("id", visit!.id);
    expect(error?.message).toBe("ERR_IMMUTABLE");
  });

  it("indicateurs du poste de contrôle", async () => {
    const { matricule } = await createAthlete(admin, { start: t, end: t });
    await agent.rpc("control_record_entry", { p_matricule: matricule });
    const { data } = await agent.rpc("control_overview");
    const overview = data as Record<string, number>;
    expect(overview.my_entries_today).toBeGreaterThan(0);
    expect(overview.present_now).toBeGreaterThan(0);

    const { data: present } = await agent.rpc("control_present", { p_limit: 200 });
    expect(present?.some((p) => p.matricule === matricule)).toBe(true);

    const { data: activity } = await agent.rpc("control_my_activity", { p_limit: 100 });
    expect(activity?.some((a) => a.matricule === matricule && a.kind === "entry")).toBe(true);
  });

  describe("corrections administratives", () => {
    it("clôture une visite oubliée avec motif et journalisation", async () => {
      const { matricule, athleteId } = await createAthlete(admin, { start: t, end: t });
      await agent.rpc("control_record_entry", { p_matricule: matricule });
      const { data: visit } = await admin.from("visits").select("id, entered_at").eq("athlete_id", athleteId).single();

      const noReason = await admin.rpc("admin_correct_visit", {
        p_visit_id: visit!.id,
        p_action: "close",
        p_exited_at: new Date().toISOString(),
        p_reason: "",
      });
      expect(noReason.error?.message).toBe("ERR_REASON_REQUIRED");

      const beforeEntry = await admin.rpc("admin_correct_visit", {
        p_visit_id: visit!.id,
        p_action: "close",
        p_exited_at: new Date(new Date(visit!.entered_at).getTime() - 60_000).toISOString(),
        p_reason: "Sortie non enregistrée",
      });
      expect(beforeEntry.error?.message).toBe("ERR_DATE_INVALID");

      const ok = await admin.rpc("admin_correct_visit", {
        p_visit_id: visit!.id,
        p_action: "close",
        p_exited_at: new Date().toISOString(),
        p_reason: "Sortie non enregistrée",
      });
      expect(ok.error).toBeNull();

      const { data: after } = await admin.from("visits").select("status, corrected_at, correction_reason").eq("id", visit!.id).single();
      expect(after).toMatchObject({ status: "closed", correction_reason: "Sortie non enregistrée" });
      const { data: log } = await admin.from("audit_logs").select("action").eq("entity_id", visit!.id);
      expect(log?.[0]?.action).toBe("visit.corrected");
    });

    it("annule une entrée erronée : elle sort des statistiques et libère l'entrée", async () => {
      const { matricule, athleteId } = await createAthlete(admin, { start: t, end: t });
      await agent.rpc("control_record_entry", { p_matricule: matricule });
      const { data: visit } = await admin.from("visits").select("id").eq("athlete_id", athleteId).single();
      expect(
        (await admin.rpc("admin_correct_visit", {
          p_visit_id: visit!.id,
          p_action: "cancel",
          p_exited_at: null as unknown as string,
          p_reason: "Mauvais matricule saisi",
        })).error,
      ).toBeNull();
      expect((await check(matricule)).outcome).toBe("authorized");
      const { data: stats } = await admin.rpc("stats_athlete", { p_athlete_id: athleteId });
      expect((stats as Record<string, number>).visits_total).toBe(0);
    });
  });
});
