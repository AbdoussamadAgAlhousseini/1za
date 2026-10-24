import { z } from "zod";
import { normalizePhone } from "@/lib/auth/identity";
import { passwordSchema } from "./auth";
import { uuidSchema } from "./common";

export const phoneSchema = z
  .string({ error: "Saisissez le numéro de téléphone." })
  .max(32)
  .transform((v, ctx) => {
    const n = normalizePhone(v);
    if (!n) {
      ctx.addIssue({ code: "custom", message: "Numéro invalide. Exemple : 76 12 34 56 ou +223 76 12 34 56." });
      return z.NEVER;
    }
    return n;
  });

export const displayNameSchema = z
  .string({ error: "Saisissez le nom de l'agent." })
  .trim()
  .min(2, "2 caractères minimum.")
  .max(80, "80 caractères maximum.");

export const createAgentSchema = z.object({
  displayName: displayNameSchema,
  phone: phoneSchema,
  password: passwordSchema,
});

export const resetAgentPasswordSchema = z.object({ userId: uuidSchema, password: passwordSchema });
export const setAgentActiveSchema = z.object({ userId: uuidSchema, active: z.boolean() });
export const renameAgentSchema = z.object({ userId: uuidSchema, displayName: displayNameSchema });
