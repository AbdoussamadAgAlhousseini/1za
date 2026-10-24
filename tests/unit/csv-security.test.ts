import { describe, expect, it } from "vitest";
import { escapeCsvCell, toCsv } from "@/lib/domain/csv";
import { generatePassword } from "@/lib/password";
import { passwordSchema, adminPasswordSchema } from "@/lib/validation/auth";
import { extractErrorCode, messageForError, GENERIC_ERROR_MESSAGE } from "@/lib/domain/errors";

describe("export CSV", () => {
  it("neutralise les injections de formules", () => {
    expect(escapeCsvCell("=HYPERLINK(\"x\")")).toBe("\"'=HYPERLINK(\"\"x\"\")\"");
    expect(escapeCsvCell("+33")).toBe("'+33");
    expect(escapeCsvCell("@SUM")).toBe("'@SUM");
    expect(escapeCsvCell(-5)).toBe("-5");
  });

  it("produit un fichier compatible Excel (BOM, ;, CRLF, décimales à virgule)", () => {
    const csv = toCsv([{ a: "x;y", b: 1.5 }], [
      { header: "A", value: (r) => r.a },
      { header: "B", value: (r) => r.b },
    ]);
    expect(csv.startsWith("﻿")).toBe(true);
    expect(csv).toBe("﻿A;B\r\n\"x;y\";1,5\r\n");
  });
});

describe("mots de passe", () => {
  it("génère des mots de passe conformes et variés", () => {
    const set = new Set<string>();
    for (let i = 0; i < 50; i++) {
      const pw = generatePassword();
      expect(passwordSchema.safeParse(pw).success).toBe(true);
      expect(adminPasswordSchema.safeParse(pw).success).toBe(true);
      expect(pw).not.toMatch(/[0O1lI]/);
      set.add(pw);
    }
    expect(set.size).toBe(50);
  });

  it("applique la politique (administrateur : 12 caractères)", () => {
    expect(passwordSchema.safeParse("Abcdefgh12").success).toBe(true);
    expect(passwordSchema.safeParse("abcdefgh12").success).toBe(false);
    expect(adminPasswordSchema.safeParse("Abcdefgh12").success).toBe(false);
  });
});

describe("erreurs", () => {
  it("traduit les codes métier et masque les erreurs techniques", () => {
    expect(extractErrorCode({ message: "ERR_ALREADY_INSIDE" })).toBe("ERR_ALREADY_INSIDE");
    expect(messageForError({ message: "duplicate key value violates unique constraint" })).toBe(GENERIC_ERROR_MESSAGE);
  });
});
