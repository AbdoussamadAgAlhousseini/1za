import { z } from "zod";
import { isValidMatricule, normalizeMatricule } from "@/lib/domain/matricule";
import { isIsoDate } from "@/lib/domain/periods";

export const matriculeSchema = z
  .string({ error: "Saisissez un matricule." })
  .max(32, "Matricule invalide.")
  .transform(normalizeMatricule)
  .refine(isValidMatricule, "Matricule invalide : 2 lettres suivies de 5 chiffres (ex. AD76214).");

export const uuidSchema = z.uuid("Identifiant invalide.");

export const isoDateSchema = z.string().refine(isIsoDate, "Date invalide.");

export const optionalIsoDate = z
  .string()
  .optional()
  .transform((v) => (v ? v : undefined))
  .refine((v) => v === undefined || isIsoDate(v), "Date invalide.");

export const reasonSchema = z
  .string({ error: "Indiquez un motif." })
  .trim()
  .min(5, "Le motif doit comporter au moins 5 caractères.")
  .max(300, "300 caractères maximum.");
