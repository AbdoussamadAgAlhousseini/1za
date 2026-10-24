import { describe, expect, it } from "vitest";
import { explainMatriculeError, formatMatricule, isValidMatricule, maskMatricule, normalizeMatricule } from "@/lib/domain/matricule";

describe("matricule", () => {
  it.each([
    ["ad76214", "AD76214"],
    [" AD 762-14 ", "AD76214"],
    ["ad.76.214", "AD76214"],
    ["Éd76214", "ED76214"],
  ])("normalise %j en %j", (raw, expected) => {
    expect(normalizeMatricule(raw)).toBe(expected);
  });

  it.each(["AD76214", "ZZ00000"])("accepte %s", (v) => expect(isValidMatricule(v)).toBe(true));
  it.each(["A76214", "AD7621", "AD762145", "1D76214", "ADX7621", "", "ad76214"])("refuse %j", (v) => expect(isValidMatricule(v)).toBe(false));

  it("explique précisément l'erreur", () => {
    expect(explainMatriculeError("")).toMatch(/Saisissez/);
    expect(explainMatriculeError("A1")).toMatch(/deux lettres/);
    expect(explainMatriculeError("AD76")).toMatch(/Il manque 3/);
    expect(explainMatriculeError("AD7621X")).toMatch(/que des chiffres/);
    expect(explainMatriculeError("AD762145")).toMatch(/exactement 7/);
    expect(explainMatriculeError("ad 76214")).toBeNull();
  });

  it("formate et masque sans révéler plus que nécessaire", () => {
    expect(formatMatricule("AD76214")).toBe("AD 76214");
    expect(maskMatricule("AD76214")).toBe("AD•••14");
    expect(maskMatricule("invalide")).toBe("•••••••");
  });
});
