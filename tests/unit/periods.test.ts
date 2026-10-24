import { describe, expect, it } from "vitest";
import {
  addDays,
  computeEndDate,
  daysBetween,
  defaultGranularity,
  isIsoDate,
  resolvePreset,
  startOfIsoWeek,
  suggestRenewalStart,
  validatePeriod,
} from "@/lib/domain/periods";

describe("périodes et dates d'abonnement", () => {
  it("valide les dates ISO réelles uniquement", () => {
    expect(isIsoDate("2026-02-28")).toBe(true);
    expect(isIsoDate("2026-02-30")).toBe(false);
    expect(isIsoDate("24/10/2026")).toBe(false);
  });

  it("calcule la date de fin incluse à partir d'une durée", () => {
    expect(computeEndDate("2026-10-24", 30)).toBe("2026-11-22");
    expect(computeEndDate("2026-10-24", 1)).toBe("2026-10-24");
    expect(computeEndDate("2028-02-01", 29)).toBe("2028-02-29");
  });

  it("propose un renouvellement sans trou ni chevauchement", () => {
    expect(suggestRenewalStart("2026-10-30", "2026-10-24")).toBe("2026-10-31");
    expect(suggestRenewalStart("2026-10-10", "2026-10-24")).toBe("2026-10-24");
    expect(suggestRenewalStart("2026-10-23", "2026-10-24")).toBe("2026-10-24");
    expect(suggestRenewalStart(null, "2026-10-24")).toBe("2026-10-24");
  });

  it("semaine ISO du lundi au dimanche", () => {
    expect(startOfIsoWeek("2026-10-24")).toBe("2026-10-19"); // samedi → lundi
    expect(startOfIsoWeek("2026-10-25")).toBe("2026-10-19"); // dimanche → lundi précédent
    expect(startOfIsoWeek("2026-10-19")).toBe("2026-10-19");
  });

  it("préréglages de période", () => {
    expect(resolvePreset("today", "2026-10-24")).toEqual({ from: "2026-10-24", to: "2026-10-24" });
    expect(resolvePreset("month", "2026-10-24")).toEqual({ from: "2026-10-01", to: "2026-10-24" });
    expect(resolvePreset("30d", "2026-10-24")).toEqual({ from: "2026-09-25", to: "2026-10-24" });
    expect(resolvePreset("year", "2026-10-24").from).toBe("2026-01-01");
  });

  it("granularité et validation", () => {
    expect(defaultGranularity({ from: "2026-10-01", to: "2026-10-24" })).toBe("day");
    expect(defaultGranularity({ from: "2026-01-01", to: "2026-10-24" })).toBe("week");
    expect(defaultGranularity({ from: "2024-01-01", to: "2026-10-24" })).toBe("month");
    expect(validatePeriod("2026-10-24", "2026-10-01")).toBeNull();
    expect(validatePeriod("x", "2026-10-01")).toBeNull();
    expect(daysBetween("2026-10-01", addDays("2026-10-01", 10))).toBe(10);
  });
});
