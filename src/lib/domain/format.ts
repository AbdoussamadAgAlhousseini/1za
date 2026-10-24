/**
 * Formatage français des dates, durées et montants. Toutes les dates sont
 * affichées dans le fuseau du stade (paramètre `timezone`), jamais dans celui
 * de l'appareil.
 */

export const DEFAULT_TIMEZONE = "Africa/Bamako";
const LOCALE = "fr-FR";

/** Date ISO « AAAA-MM-JJ » (date calendaire, sans heure). */
export type IsoDate = string;

function parseIsoDate(value: IsoDate): Date {
  const [y, m, d] = value.split("-").map(Number);
  return new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1, 12));
}

export function formatDate(value: IsoDate | null | undefined, style: "short" | "long" = "short"): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat(LOCALE, {
    timeZone: "UTC",
    day: "2-digit",
    month: style === "long" ? "long" : "2-digit",
    year: "numeric",
  }).format(parseIsoDate(value));
}

export function formatDayLabel(value: IsoDate): string {
  return new Intl.DateTimeFormat(LOCALE, { timeZone: "UTC", day: "numeric", month: "short" }).format(
    parseIsoDate(value),
  );
}

export function formatMonthLabel(value: IsoDate): string {
  return new Intl.DateTimeFormat(LOCALE, { timeZone: "UTC", month: "short", year: "2-digit" }).format(
    parseIsoDate(value),
  );
}

export function formatDateTime(value: string | null | undefined, timeZone = DEFAULT_TIMEZONE): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat(LOCALE, {
    timeZone,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export function formatTime(value: string | null | undefined, timeZone = DEFAULT_TIMEZONE): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat(LOCALE, { timeZone, hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

/** Durée lisible : « 45 min », « 1 h 05 », « 2 j 3 h ». */
export function formatDuration(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined || !Number.isFinite(seconds) || seconds < 0) return "—";
  const totalMinutes = Math.floor(seconds / 60);
  if (totalMinutes < 1) return "< 1 min";
  if (totalMinutes < 60) return `${totalMinutes} min`;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours < 24) return minutes === 0 ? `${hours} h` : `${hours} h ${String(minutes).padStart(2, "0")}`;
  const days = Math.floor(hours / 24);
  const remHours = hours % 24;
  return remHours === 0 ? `${days} j` : `${days} j ${remHours} h`;
}

export function formatNumber(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  return new Intl.NumberFormat(LOCALE).format(value);
}

export function formatMoney(amount: number | string | null | undefined, currency: string): string {
  const value = typeof amount === "string" ? Number(amount) : amount;
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  const zeroDecimal = currency === "XOF" || currency === "XAF";
  return new Intl.NumberFormat(LOCALE, {
    style: "currency",
    currency,
    maximumFractionDigits: zeroDecimal ? 0 : 2,
    minimumFractionDigits: zeroDecimal ? 0 : 2,
  }).format(value);
}

/** « dans 3 jours », « aujourd'hui », « il y a 2 jours » (par rapport à la date du stade). */
export function formatRelativeDays(days: number | null | undefined): string {
  if (days === null || days === undefined) return "—";
  if (days === 0) return "aujourd'hui";
  if (days === 1) return "demain";
  if (days === -1) return "hier";
  return days > 0 ? `dans ${days} jours` : `il y a ${Math.abs(days)} jours`;
}

export function pluralize(count: number, singular: string, plural?: string): string {
  return `${formatNumber(count)} ${Math.abs(count) > 1 ? (plural ?? `${singular}s`) : singular}`;
}
