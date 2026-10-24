import { z } from "zod";
import { normalizePhone } from "@/lib/auth/identity";

export const agentSignInSchema = z.object({
  phone: z
    .string({ error: "Saisissez votre numéro de téléphone." })
    .max(32)
    .transform((v, ctx) => {
      const n = normalizePhone(v);
      if (!n) {
        ctx.addIssue({ code: "custom", message: "Numéro invalide. Exemple : 76 12 34 56." });
        return z.NEVER;
      }
      return n;
    }),
  password: z.string().min(1, "Saisissez votre mot de passe.").max(128),
});

export const adminSignInSchema = z.object({
  password: z.string().min(1, "Saisissez le mot de passe administrateur.").max(128),
});

/** Politique alignée sur la configuration Supabase Auth (10 caractères, minuscule, majuscule, chiffre). */
export const passwordSchema = z
  .string()
  .min(10, "10 caractères minimum.")
  .max(128, "128 caractères maximum.")
  .regex(/[a-z]/, "Au moins une lettre minuscule.")
  .regex(/[A-Z]/, "Au moins une lettre majuscule.")
  .regex(/[0-9]/, "Au moins un chiffre.");

/** Le mot de passe administrateur étant le seul facteur, il est plus long. */
export const adminPasswordSchema = passwordSchema.min(12, "12 caractères minimum pour l'administrateur.");

export const changePasswordSchema = z
  .object({
    current: z.string().min(1, "Saisissez votre mot de passe actuel."),
    password: z.string(),
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, { path: ["confirm"], message: "Les deux mots de passe ne correspondent pas." })
  .refine((v) => v.password !== v.current, { path: ["password"], message: "Choisissez un mot de passe différent de l'actuel." });
