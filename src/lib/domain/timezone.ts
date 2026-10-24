/**
 * Conversion d'une date-heure « murale » (saisie dans le fuseau du stade,
 * format AAAA-MM-JJTHH:mm) en instant UTC ISO, indépendamment du fuseau de
 * l'appareil ou du serveur.
 */
function offsetMinutes(instant: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(instant);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return Math.round((asUtc - instant.getTime()) / 60_000);
}

export function zonedLocalToUtcIso(local: string, timeZone: string): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(local);
  if (!m) return null;
  const [, y, mo, d, h, mi] = m.map(Number) as [number, number, number, number, number, number];
  const guess = Date.UTC(y, mo - 1, d, h, mi);
  let instant = guess - offsetMinutes(new Date(guess), timeZone) * 60_000;
  // Seconde passe pour les changements d'heure éventuels.
  instant = guess - offsetMinutes(new Date(instant), timeZone) * 60_000;
  const date = new Date(instant);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

/** Instant ISO → valeur pour <input type="datetime-local"> dans le fuseau donné. */
export function utcIsoToZonedLocal(iso: string, timeZone: string): string {
  const date = new Date(iso);
  const local = new Date(date.getTime() + offsetMinutes(date, timeZone) * 60_000);
  return local.toISOString().slice(0, 16);
}
