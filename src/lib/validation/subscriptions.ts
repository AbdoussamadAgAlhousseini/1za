import { z } from "zod";
import { PAYMENT_METHODS } from "@/lib/domain/status";
import { isoDateSchema, reasonSchema, uuidSchema } from "./common";

const currencySchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z]{3}$/, "Code devise sur 3 lettres (ex. XOF).");

export const paymentFieldsSchema = z.object({
  amount: z.coerce
    .number({ error: "Montant invalide." })
    .positive("Le montant doit être supérieur à 0.")
    .max(100_000_000, "Montant trop élevé."),
  currency: currencySchema,
  method: z.enum(PAYMENT_METHODS as [string, ...string[]], { error: "Choisissez un mode de paiement." }),
  reference: z.string().trim().max(80, "80 caractères maximum.").optional(),
  paidOn: isoDateSchema,
});

export const subscriptionFieldsSchema = z
  .object({
    planId: uuidSchema.nullable(),
    startsOn: isoDateSchema,
    endsOn: isoDateSchema,
    withPayment: z.boolean(),
    payment: paymentFieldsSchema.optional(),
  })
  .refine((v) => v.endsOn >= v.startsOn, { path: ["endsOn"], message: "La date de fin doit suivre la date de début." })
  .refine((v) => !v.withPayment || v.payment, { path: ["payment"], message: "Complétez le paiement." });

export const createSubscriptionSchema = z.object({
  athleteId: uuidSchema,
  renewedFromId: uuidSchema.nullable(),
  subscription: subscriptionFieldsSchema,
});

export const subscriptionStateSchema = z.object({
  subscriptionId: uuidSchema,
  state: z.enum(["active", "suspended", "cancelled"]),
  reason: reasonSchema,
});

export const recordPaymentSchema = z.object({
  athleteId: uuidSchema,
  subscriptionId: uuidSchema.nullable(),
  payment: paymentFieldsSchema,
});

export const cancelPaymentSchema = z.object({ paymentId: uuidSchema, reason: reasonSchema });
