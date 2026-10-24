import { z } from "zod";

export const signInSchema = z.object({
  email: z.email("Adresse e-mail invalide.").max(254).transform((v) => v.trim().toLowerCase()),
  password: z.string().min(1, "Saisissez votre mot de passe.").max(128),
});

export const resetRequestSchema = z.object({
  email: z.email("Adresse e-mail invalide.").max(254).transform((v) => v.trim().toLowerCase()),
});

/** Politique alignée sur la configuration Supabase Auth (10 caractères, minuscule, majuscule, chiffre). */
export const passwordSchema = z
  .string()
  .min(10, "10 caractères minimum.")
  .max(128, "128 caractères maximum.")
  .regex(/[a-z]/, "Au moins une lettre minuscule.")
  .regex(/[A-Z]/, "Au moins une lettre majuscule.")
  .regex(/[0-9]/, "Au moins un chiffre.");

export const newPasswordSchema = z
  .object({ password: passwordSchema, confirm: z.string() })
  .refine((v) => v.password === v.confirm, { path: ["confirm"], message: "Les deux mots de passe ne correspondent pas." });
