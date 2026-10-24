import { beforeAll, describe, expect, it } from "vitest";
import { createAthlete, createStaff, dbTestsEnabled, shiftDate, today, type Client } from "./helpers";

describe.skipIf(!dbTestsEnabled)("statistiques", () => {
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

  it("distingue entrées, sportifs uniques et visites terminées", async () => {
    const before = (await admin.rpc("stats_dashboard")).data as Record<string, number>;

    const a1 = await createAthlete(admin, { start: t, end: t });
    const a2 = await createAthlete(admin, { start: t, end: t });
    // a1 : deux visites terminées ; a2 : une visite en cours.
    for (let i = 0; i < 2; i++) {
      expect((await agent.rpc("control_record_entry", { p_matricule: a1.matricule })).error).toBeNull();
      expect((await agent.rpc("control_record_exit", { p_matricule: a1.matricule })).error).toBeNull();
    }
    expect((await agent.rpc("control_record_entry", { p_matricule: a2.matricule })).error).toBeNull();

    const after = (await admin.rpc("stats_dashboard")).data as Record<string, number>;
    expect(after.entries_today - before.entries_today).toBe(3);
    expect(after.unique_today - before.unique_today).toBe(2);
    expect(after.completed_today - before.completed_today).toBe(2);
    expect(after.present_now - before.present_now).toBe(1);
    expect(after.athletes_total - before.athletes_total).toBe(2);

    const { data: athleteStats } = await admin.rpc("stats_athlete", { p_athlete_id: a1.athleteId });
    expect(athleteStats).toMatchObject({ visits_today: 2, visits_total: 2, completed_total: 2, is_inside: false });
  });

  it("série de fréquentation : un point par jour, zéros inclus", async () => {
    const from = shiftDate(t, -6);
    const { data, error } = await admin.rpc("stats_attendance", { p_from: from, p_to: t, p_granularity: "day" });
    expect(error).toBeNull();
    expect(data).toHaveLength(7);
    expect(data![0]!.bucket).toBe(from);
    expect(data![6]!.bucket).toBe(t);
    expect(data![6]!.entries).toBeGreaterThan(0);
  });

  it("série par semaine et par mois", async () => {
    const week = await admin.rpc("stats_attendance", { p_from: shiftDate(t, -27), p_to: t, p_granularity: "week" });
    expect(week.error).toBeNull();
    expect(week.data!.length).toBeGreaterThanOrEqual(4);
    const month = await admin.rpc("stats_attendance", { p_from: shiftDate(t, -60), p_to: t, p_granularity: "month" });
    expect(month.data!.length).toBeGreaterThanOrEqual(2);
  });

  it("refuse une période invalide ou une granularité inconnue", async () => {
    expect((await admin.rpc("stats_attendance", { p_from: t, p_to: shiftDate(t, -1) })).error?.message).toBe("ERR_DATE_INVALID");
    expect(
      (await admin.rpc("stats_attendance", { p_from: t, p_to: t, p_granularity: "hour" })).error?.message,
    ).toBe("ERR_INVALID_INPUT");
  });

  it("heures de pointe et activité des agents", async () => {
    const peaks = await admin.rpc("stats_peak_hours", { p_from: t, p_to: t });
    expect(peaks.error).toBeNull();
    expect(peaks.data!.reduce((s, r) => s + r.entries, 0)).toBeGreaterThan(0);

    const agents = await admin.rpc("stats_agents", { p_from: t, p_to: t });
    const mine = agents.data!.find((r) => r.profile_id === agentId);
    expect(mine?.entries_recorded).toBe(3);
    expect(mine?.exits_recorded).toBe(2);
  });

  it("recettes par devise et formule", async () => {
    const a = await createAthlete(admin, { start: t, end: t });
    await admin.rpc("admin_record_payment", {
      p_athlete_id: a.athleteId,
      p_subscription_id: a.subscriptionId!,
      p_amount: 2500,
      p_currency: "XOF",
      p_paid_on: t,
      p_method: "cash",
    });
    const { data } = await admin.rpc("stats_revenue", { p_from: t, p_to: t });
    const xof = data!.filter((r) => r.currency === "XOF").reduce((s, r) => s + Number(r.total), 0);
    expect(xof).toBeGreaterThanOrEqual(2500);
  });
});
