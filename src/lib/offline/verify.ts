import type { ControlCheck } from "@/lib/control-types";
import type { OfflineSnapshot, QueuedOperation } from "./types";

/** SHA-256(sel || matricule) en hexadécimal — identique à private.offline_hash(). */
export async function hashMatricule(salt: string, matricule: string): Promise<string> {
  const data = new TextEncoder().encode(`${salt}${matricule}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Date locale (AAAA-MM-JJ) d'un instant dans le fuseau du stade. */
export function localDate(instant: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(instant);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

function dayDiff(a: string, b: string) {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);
}

export type SnapshotState = "ok" | "expired" | "clock_error";

/** Tolérance sur l'horloge de l'appareil par rapport à l'heure du serveur. */
const CLOCK_TOLERANCE_MS = 10 * 60_000;

export function snapshotState(snapshot: OfflineSnapshot, now: Date): SnapshotState {
  if (now.getTime() < Date.parse(snapshot.generated_at) - CLOCK_TOLERANCE_MS) return "clock_error";
  if (now.getTime() > Date.parse(snapshot.valid_until)) return "expired";
  return "ok";
}

/**
 * Vérification sur l'appareil, même logique que control_check() :
 * abonnement de référence, validité (fin incluse) et présence (entrées
 * connues au moment du téléchargement + opérations locales en attente).
 */
export function verifyOffline(params: {
  snapshot: OfflineSnapshot;
  matricule: string;
  hash: string;
  queue: QueuedOperation[];
  now: Date;
}): ControlCheck {
  const { snapshot, matricule, hash, queue, now } = params;
  const today = localDate(now, snapshot.timezone);
  const subs = snapshot.subscriptions.filter((s) => s.h === hash);

  const current = subs.find((s) => s.s <= today && today <= s.e);
  const upcoming = subs.filter((s) => s.s > today).sort((a, b) => a.s.localeCompare(b.s))[0];
  const past = subs.filter((s) => s.e < today).sort((a, b) => b.e.localeCompare(a.e))[0];
  const ref = current ?? upcoming ?? past;

  let validity: "active" | "suspended" | "upcoming" | "expired" | "none" = "none";
  if (current) validity = current.st === "suspended" ? "suspended" : "active";
  else if (upcoming) validity = "upcoming";
  else if (past) validity = "expired";

  // Présence : état au téléchargement, puis opérations locales dans l'ordre.
  let insideSince: string | null = snapshot.inside.find((i) => i.h === hash)?.at ?? null;
  for (const op of [...queue].filter((q) => q.matricule === matricule).sort((a, b) => a.occurredAt.localeCompare(b.occurredAt))) {
    insideSince = op.kind === "entry" ? op.occurredAt : null;
  }

  const outcome: ControlCheck["outcome"] = insideSince
    ? "already_inside"
    : validity === "active"
      ? "authorized"
      : validity === "none"
        ? "no_subscription"
        : validity;

  return {
    outcome,
    matricule,
    validity,
    checked_at: now.toISOString(),
    subscription: ref ? { starts_on: ref.s, ends_on: ref.e, plan_name: ref.p, days_remaining: dayDiff(today, ref.e) } : null,
    open_visit: insideSince ? { entered_at: insideSince } : null,
  };
}
