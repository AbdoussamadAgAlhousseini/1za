import { describe, expect, it } from "vitest";
import { formatDate, formatDateTime, formatDuration, formatMoney, formatRelativeDays, pluralize } from "@/lib/domain/format";
import { zonedLocalToUtcIso, utcIsoToZonedLocal } from "@/lib/domain/timezone";

const nbsp = (s: string) => s.replace(/[  ]/g, " ");

describe("formatage", () => {
  it.each([
    [null, "—"],
    [30, "< 1 min"],
    [45 * 60, "45 min"],
    [65 * 60, "1 h 05"],
    [2 * 3600, "2 h"],
    [26 * 3600, "1 j 2 h"],
  ])("durée %s s → %s", (s, expected) => expect(formatDuration(s)).toBe(expected));

  it("dates en français, indépendantes du fuseau de l'appareil", () => {
    expect(formatDate("2026-10-24")).toBe("24/10/2026");
    expect(formatDate("2026-10-24", "long")).toBe("24 octobre 2026");
    expect(formatDateTime("2026-10-24T18:30:00Z", "Africa/Bamako")).toBe("24/10/2026 18:30");
    expect(formatDateTime("2026-10-24T18:30:00Z", "Europe/Paris")).toBe("24/10/2026 20:30");
  });

  it("montants en francs CFA sans décimales", () => {
    expect(nbsp(formatMoney(7500, "XOF"))).toBe("7 500 F CFA");
    expect(nbsp(formatMoney("12.5", "EUR"))).toBe("12,50 €");
  });

  it("jours relatifs et pluriels", () => {
    expect(formatRelativeDays(0)).toBe("aujourd'hui");
    expect(formatRelativeDays(3)).toBe("dans 3 jours");
    expect(formatRelativeDays(-2)).toBe("il y a 2 jours");
    expect(pluralize(1, "jour")).toBe("1 jour");
    expect(pluralize(2, "jour")).toBe("2 jours");
  });

  it("convertit l'heure du stade en instant UTC et inversement", () => {
    expect(zonedLocalToUtcIso("2026-10-24T18:30", "Africa/Bamako")).toBe("2026-10-24T18:30:00.000Z");
    expect(zonedLocalToUtcIso("2026-07-01T20:00", "Europe/Paris")).toBe("2026-07-01T18:00:00.000Z");
    expect(zonedLocalToUtcIso("invalide", "UTC")).toBeNull();
    expect(utcIsoToZonedLocal("2026-07-01T18:00:00.000Z", "Europe/Paris")).toBe("2026-07-01T20:00");
  });
});
