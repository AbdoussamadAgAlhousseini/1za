import type { IsoDate } from "./format";

/**
 * Périodes d'analyse. La date de référence (« aujourd'hui ») est TOUJOURS
 * fournie par le serveur (`app_today()`, fuseau du stade), jamais par l'horloge
 * de l'appareil.
 *
 * - Semaine : du lundi au dimanche (ISO 8601).
 * - Mois : mois civil.
 */

export const PERIOD_PRESETS = ["today", "week", "month", "30d", "90d", "year"] as const;
export type PeriodPreset = (typeof PERIOD_PRESETS)[number];

export const PERIOD_LABELS: Record<PeriodPreset, string> = {
  today: "Aujourd'hui",
  week: "Cette semaine",
  month: "Ce mois-ci",
  "30d": "30 derniers jours",
  "90d": "90 derniers jours",
  year: "Cette année",
};

export type Granularity = "day" | "week" | "month";
export const GRANULARITY_LABELS: Record<Granularity, string> = { day: "Jour", week: "Semaine", month: "Mois" };

export interface Period {
  from: IsoDate;
  to: IsoDate;
}

export const MAX_PERIOD_DAYS = 3660;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function toUtc(value: IsoDate): Date {
  const [y, m, d] = value.split("-").map(Number);
  return new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1));
}

function toIso(date: Date): IsoDate {
  return date.toISOString().slice(0, 10);
}

export function isIsoDate(value: unknown): value is IsoDate {
  if (typeof value !== "string" || !ISO_DATE.test(value)) return false;
  const date = toUtc(value);
  return !Number.isNaN(date.getTime()) && toIso(date) === value;
}

export function addDays(value: IsoDate, days: number): IsoDate {
  const date = toUtc(value);
  date.setUTCDate(date.getUTCDate() + days);
  return toIso(date);
}

/** Nombre de jours entre deux dates (b − a). */
export function daysBetween(a: IsoDate, b: IsoDate): number {
  return Math.round((toUtc(b).getTime() - toUtc(a).getTime()) / 86_400_000);
}

export function startOfIsoWeek(value: IsoDate): IsoDate {
  const date = toUtc(value);
  const isoDow = date.getUTCDay() === 0 ? 7 : date.getUTCDay();
  return addDays(value, 1 - isoDow);
}

export function startOfMonth(value: IsoDate): IsoDate {
  return `${value.slice(0, 7)}-01`;
}

export function resolvePreset(preset: PeriodPreset, today: IsoDate): Period {
  switch (preset) {
    case "today":
      return { from: today, to: today };
    case "week":
      return { from: startOfIsoWeek(today), to: today };
    case "month":
      return { from: startOfMonth(today), to: today };
    case "30d":
      return { from: addDays(today, -29), to: today };
    case "90d":
      return { from: addDays(today, -89), to: today };
    case "year":
      return { from: `${today.slice(0, 4)}-01-01`, to: today };
  }
}

/** Granularité adaptée à la longueur de la période. */
export function defaultGranularity(period: Period): Granularity {
  const length = daysBetween(period.from, period.to) + 1;
  if (length <= 62) return "day";
  if (length <= 366) return "week";
  return "month";
}

export function validatePeriod(from: unknown, to: unknown): Period | null {
  if (!isIsoDate(from) || !isIsoDate(to)) return null;
  const length = daysBetween(from, to);
  if (length < 0 || length > MAX_PERIOD_DAYS) return null;
  return { from, to };
}

/**
 * Début conseillé d'un renouvellement : le lendemain de la fin de l'abonnement
 * précédent s'il est encore en cours ou à venir, sinon aujourd'hui (pas de
 * période « offerte » rétroactivement).
 */
export function suggestRenewalStart(previousEndsOn: IsoDate | null, today: IsoDate): IsoDate {
  if (!previousEndsOn) return today;
  const next = addDays(previousEndsOn, 1);
  return daysBetween(today, next) > 0 ? next : today;
}

/** Date de fin calculée à partir d'une durée en jours (date de fin incluse). */
export function computeEndDate(startsOn: IsoDate, durationDays: number): IsoDate {
  return addDays(startsOn, durationDays - 1);
}
