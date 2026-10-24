import { describe, expect, it } from "vitest";
import { ADMIN_LOGIN_EMAIL, agentLoginEmail, formatPhone, normalizePhone } from "@/lib/auth/identity";

describe("identifiants de connexion", () => {
  it.each([
    ["76 12 34 56", "22376123456"],
    ["76123456", "22376123456"],
    ["+223 76 12 34 56", "22376123456"],
    ["0022376123456", "22376123456"],
    ["+33 6 12 34 56 78", "33612345678"],
  ])("normalise %j", (raw, expected) => expect(normalizePhone(raw)).toBe(expected));

  it.each(["", "1234", "abc", "+223 76 12"])("refuse %j", (raw) => expect(normalizePhone(raw)).toBeNull());

  it("dérive une adresse technique non routable", () => {
    expect(agentLoginEmail("22376123456")).toBe("agent.22376123456@stade26.invalid");
    expect(ADMIN_LOGIN_EMAIL.endsWith(".invalid")).toBe(true);
  });

  it("affiche le numéro au format malien", () => {
    expect(formatPhone("22376123456")).toBe("+223 76 12 34 56");
    expect(formatPhone(null)).toBe("—");
  });
});
