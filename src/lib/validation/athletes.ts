import { z } from "zod";
import { ATHLETE_STATUSES } from "@/lib/domain/status";
import { isoDateSchema, matriculeSchema, optionalIsoDate } from "./common";
import { subscriptionFieldsSchema } from "./subscriptions";

export const ATHLETE_SORTS = ["registered_desc", "registered_asc", "matricule_asc", "last_visit_desc", "ends_on_asc"] as const;
export type AthleteSort = (typeof ATHLETE_SORTS)[number];

export const ATHLETE_SORT_LABELS: Record<AthleteSort, string> = {
  registered_desc: "Inscription récente",
  registered_asc: "Inscription ancienne",
  matricule_asc: "Matricule (A → Z)",
  last_visit_desc: "Dernière visite",
  ends_on_asc: "Fin d'abonnement proche",
};

export const athleteStatusFilter = z.enum([...ATHLETE_STATUSES, "expiring", "all"]).default("all");
export type AthleteStatusFilter = z.infer<typeof athleteStatusFilter>;

export const PAGE_SIZE = 25;

export const athleteListSchema = z.object({
  // Recherche par début de matricule : uniquement lettres et chiffres.
  search: z
    .string()
    .max(16)
    .default("")
    .transform((v) => v.normalize("NFD").replace(/\p{M}/gu, "").replace(/[^A-Za-z0-9]/g, "").toUpperCase().slice(0, 7)),
  status: athleteStatusFilter,
  registeredFrom: optionalIsoDate,
  registeredTo: optionalIsoDate,
  sort: z.enum(ATHLETE_SORTS).default("registered_desc"),
  page: z.number().int().min(1).max(100_000).default(1),
});
export type AthleteListInput = z.input<typeof athleteListSchema>;

export const registerAthleteSchema = z
  .object({
    matricule: matriculeSchema,
    registeredOn: isoDateSchema,
    withSubscription: z.boolean(),
    subscription: subscriptionFieldsSchema.optional(),
  })
  .refine((v) => !v.withSubscription || v.subscription, { path: ["subscription"], message: "Complétez l'abonnement." });
