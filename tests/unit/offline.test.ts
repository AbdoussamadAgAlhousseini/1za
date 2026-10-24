import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { hashMatricule, localDate, snapshotState, verifyOffline } from "@/lib/offline/verify";
import type { OfflineSnapshot, QueuedOperation } from "@/lib/offline/types";

const SALT = "ab";
const h = (m: string) => createHash("sha256").update(`${SALT}${m}`).digest("hex");

function snapshot(partial: Partial<OfflineSnapshot> = {}): OfflineSnapshot {
  return {
    version: 1,
    agent_id: "agent-1",
    generated_at: "2026-10-24T08:00:00Z",
    valid_until: "2026-10-25T08:00:00Z",
    today: "2026-10-24",
    timezone: "Africa/Bamako",
    salt: SALT,
    subscriptions: [
      { h: h("AA11111"), s: "2026-10-01", e: "2026-10-24", st: "active", p: "Mensuel" },
      { h: h("BB22222"), s: "2026-09-01", e: "2026-10-23", st: "active", p: "Mensuel" },
      { h: h("CC33333"), s: "2026-10-25", e: "2026-11-24", st: "active", p: null },
      { h: h("DD44444"), s: "2026-10-01", e: "2026-10-31", st: "suspended", p: null },
      { h: h("EE55555"), s: "2026-10-01", e: "2026-10-31", st: "active", p: null },
    ],
    inside: [{ h: h("EE55555"), at: "2026-10-24T07:30:00Z" }],
    ...partial,
  };
}

const now = new Date("2026-10-24T12:00:00Z");
const check = async (m: string, queue: QueuedOperation[] = [], snap = snapshot()) =>
  verifyOffline({ snapshot: snap, matricule: m, hash: await hashMatricule(snap.salt, m), queue, now });

describe("contrôle hors ligne", () => {
  it("hachage identique au serveur (SHA-256 sel + matricule)", async () => {
    // Valeur calculée par PostgreSQL : encode(extensions.digest('ab' || 'AD76214', 'sha256'), 'hex')
    expect(await hashMatricule("ab", "AD76214")).toBe("14be15046d84252ac2dbd8b22a241ddab144f619c50376cfbd48035082073fe2");
  });

  it.each([
    ["AA11111", "authorized"], // fin aujourd'hui incluse
    ["BB22222", "expired"],
    ["CC33333", "upcoming"],
    ["DD44444", "suspended"],
    ["EE55555", "already_inside"],
    ["ZZ99999", "no_subscription"],
  ])("%s → %s", async (m, outcome) => {
    expect((await check(m)).outcome).toBe(outcome);
  });

  it("tient compte des opérations locales en attente", async () => {
    const entry: QueuedOperation = { id: "1", agentId: "agent-1", kind: "entry", matricule: "AA11111", occurredAt: "2026-10-24T10:00:00Z" };
    expect((await check("AA11111", [entry])).outcome).toBe("already_inside");
    const exit: QueuedOperation = { ...entry, id: "2", kind: "exit", occurredAt: "2026-10-24T11:00:00Z" };
    expect((await check("AA11111", [exit, entry])).outcome).toBe("authorized");
    const exitInside: QueuedOperation = { ...exit, matricule: "EE55555" };
    expect((await check("EE55555", [exitInside])).outcome).toBe("authorized");
  });

  it("la date du jour suit le fuseau du stade", () => {
    expect(localDate(new Date("2026-10-24T23:30:00Z"), "Africa/Bamako")).toBe("2026-10-24");
    expect(localDate(new Date("2026-10-24T23:30:00Z"), "Europe/Paris")).toBe("2026-10-25");
  });

  it("refuse des données périmées ou une horloge incohérente", () => {
    const snap = snapshot();
    expect(snapshotState(snap, now)).toBe("ok");
    expect(snapshotState(snap, new Date("2026-10-25T09:00:00Z"))).toBe("expired");
    expect(snapshotState(snap, new Date("2026-10-23T08:00:00Z"))).toBe("clock_error");
  });
});
