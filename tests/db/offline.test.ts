import { beforeAll, describe, expect, it } from "vitest";
import { randomUUID, createHash } from "node:crypto";
import { anonClient, createAthlete, createStaff, dbTestsEnabled, shiftDate, today, type Client } from "./helpers";
import type { OfflineSnapshot, SyncResult } from "@/lib/offline/types";

describe.skipIf(!dbTestsEnabled)("mode hors ligne : instantané et synchronisation", () => {
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

  async function sync(client: Client, ops: { id?: string; kind: string; matricule: string; occurred_at: string }[]) {
    const { data, error } = await client.rpc("control_sync_offline", { p_ops: ops.map((o) => ({ id: o.id ?? randomUUID(), ...o })) });
    expect(error).toBeNull();
    return data as unknown as SyncResult[];
  }

  it("l'instantané ne contient que des matricules hachés", async () => {
    const { matricule } = await createAthlete(admin, { start: t, end: shiftDate(t, 10) });
    const { data, error } = await agent.rpc("control_offline_snapshot");
    expect(error).toBeNull();
    const snap = data as unknown as OfflineSnapshot;
    expect(snap.agent_id).toBe(agentId);
    expect(JSON.stringify(snap)).not.toContain(matricule);
    const hash = createHash("sha256").update(`${snap.salt}${matricule}`).digest("hex");
    expect(snap.subscriptions.some((s) => s.h === hash && s.s === t)).toBe(true);
    expect(Date.parse(snap.valid_until)).toBeGreaterThan(Date.parse(snap.generated_at));
  });

  it("refusé aux visiteurs non connectés", async () => {
    expect((await anonClient().rpc("control_offline_snapshot")).error).not.toBeNull();
    expect((await anonClient().rpc("control_sync_offline", { p_ops: [] })).error).not.toBeNull();
  });

  it("applique une entrée et une sortie hors ligne avec l'heure de l'appareil", async () => {
    const { matricule, athleteId } = await createAthlete(admin, { start: shiftDate(t, -1), end: shiftDate(t, 5) });
    const entryAt = new Date(Date.now() - 2 * 3600_000).toISOString();
    const exitAt = new Date(Date.now() - 3600_000).toISOString();
    const results = await sync(agent, [
      { kind: "exit", matricule, occurred_at: exitAt },
      { kind: "entry", matricule: matricule.toLowerCase(), occurred_at: entryAt },
    ]);
    expect(results.map((r) => r.result)).toEqual(["applied", "applied"]);

    const { data: visit } = await admin.from("visits").select("*").eq("athlete_id", athleteId).single();
    expect(visit).toMatchObject({ status: "closed", entry_offline: true, exit_offline: true, entry_agent_id: agentId, duration_seconds: 3600 });
    expect(new Date(visit!.entered_at).toISOString()).toBe(entryAt);
  });

  it("est idempotente : une opération renvoyée n'est appliquée qu'une fois", async () => {
    const { matricule, athleteId } = await createAthlete(admin, { start: t, end: t });
    const op = { id: randomUUID(), kind: "entry", matricule, occurred_at: new Date(Date.now() - 60_000).toISOString() };
    expect((await sync(agent, [op]))[0]?.result).toBe("applied");
    expect((await sync(agent, [op]))[0]?.result).toBe("applied");
    const { count } = await admin.from("visits").select("id", { count: "exact", head: true }).eq("athlete_id", athleteId);
    expect(count).toBe(1);

    const other = (await createStaff("agent")).client;
    expect((await sync(other, [op]))[0]).toMatchObject({ result: "rejected", reason: "FORBIDDEN" });
  });

  it("met « à vérifier » ce qui ne respecte pas les règles, sans l'appliquer", async () => {
    const expired = await createAthlete(admin, { start: shiftDate(t, -10), end: shiftDate(t, -3) });
    const fresh = await createAthlete(admin, { start: t, end: t });
    const now = new Date(Date.now() - 60_000).toISOString();
    const results = await sync(agent, [
      { kind: "entry", matricule: expired.matricule, occurred_at: now },
      { kind: "exit", matricule: fresh.matricule, occurred_at: now },
      { kind: "entry", matricule: "QQ99999", occurred_at: now },
      { kind: "entry", matricule: fresh.matricule, occurred_at: new Date(Date.now() + 3600_000).toISOString() },
      { kind: "entry", matricule: fresh.matricule, occurred_at: new Date(Date.now() - 80 * 3600_000).toISOString() },
      { kind: "bidon", matricule: fresh.matricule, occurred_at: now },
    ]);
    const byReason = Object.fromEntries(results.map((r) => [r.reason, r.result]));
    expect(byReason.SUBSCRIPTION_INVALID).toBe("conflict");
    expect(byReason.NO_OPEN_VISIT).toBe("conflict");
    expect(byReason.FUTURE_TIME).toBe("rejected");
    expect(byReason.TOO_OLD).toBe("rejected");
    expect(byReason.INVALID).toBe("rejected");

    const { count } = await admin.from("visits").select("id", { count: "exact", head: true }).eq("athlete_id", expired.athleteId);
    expect(count).toBe(0);

    const { data: toReview } = await admin
      .from("offline_operation_log")
      .select("id, reason_code, matricule, agent_name")
      .eq("agent_id", agentId)
      .neq("result", "applied")
      .is("reviewed_at", null);
    expect(toReview?.some((r) => r.reason_code === "SUBSCRIPTION_INVALID" && r.matricule === expired.matricule)).toBe(true);

    // Revue par l'administrateur, interdite à l'agent.
    const target = toReview!.find((r) => r.reason_code === "SUBSCRIPTION_INVALID")!;
    expect((await agent.rpc("admin_review_offline_operation", { p_id: target.id!, p_note: "Vérifié sur place" })).error?.message).toBe("ERR_FORBIDDEN");
    expect((await admin.rpc("admin_review_offline_operation", { p_id: target.id!, p_note: "Vérifié sur place" })).error).toBeNull();
    expect((await admin.rpc("admin_review_offline_operation", { p_id: target.id!, p_note: "Encore" })).error?.message).toBe("ERR_INVALID_STATE_TRANSITION");
  });

  it("refuse une entrée hors ligne qui chevauche une visite déjà connue", async () => {
    const { matricule } = await createAthlete(admin, { start: t, end: t });
    expect((await agent.rpc("control_record_entry", { p_matricule: matricule })).error).toBeNull();
    const results = await sync(agent, [{ kind: "entry", matricule, occurred_at: new Date().toISOString() }]);
    expect(results[0]).toMatchObject({ result: "conflict", reason: "ALREADY_INSIDE" });
  });

  it("l'agent ne lit pas le journal des opérations hors ligne", async () => {
    const { data } = await agent.from("offline_operations").select("id");
    expect(data).toHaveLength(0);
  });
});
