/**
 * Statuts calculés par le serveur et leur présentation. La couleur n'est
 * jamais le seul signal : chaque statut a un libellé et une icône.
 */

export const SUBSCRIPTION_VALIDITIES = ["active", "expired", "upcoming", "suspended", "cancelled"] as const;
export type SubscriptionValidity = (typeof SUBSCRIPTION_VALIDITIES)[number];

export const ATHLETE_STATUSES = ["active", "expired", "upcoming", "suspended", "none"] as const;
export type AthleteStatus = (typeof ATHLETE_STATUSES)[number];

export type Tone = "success" | "danger" | "warning" | "info" | "neutral";

export const VALIDITY_PRESENTATION: Record<
  SubscriptionValidity | "none",
  { label: string; tone: Tone; description: string }
> = {
  active: { label: "Actif", tone: "success", description: "Abonnement valide aujourd'hui." },
  expired: { label: "Expiré", tone: "danger", description: "La date de fin est dépassée." },
  upcoming: { label: "Pas encore valide", tone: "info", description: "La date de début n'est pas atteinte." },
  suspended: { label: "Suspendu", tone: "warning", description: "Suspendu par l'administration." },
  cancelled: { label: "Annulé", tone: "neutral", description: "Annulé par l'administration." },
  none: { label: "Sans abonnement", tone: "neutral", description: "Aucun abonnement enregistré." },
};

export const VISIT_STATUS_PRESENTATION: Record<"open" | "closed" | "cancelled", { label: string; tone: Tone }> = {
  open: { label: "En cours", tone: "info" },
  closed: { label: "Terminée", tone: "success" },
  cancelled: { label: "Annulée", tone: "neutral" },
};

export const PAYMENT_METHOD_LABELS = {
  cash: "Espèces",
  mobile_money: "Mobile money",
  bank_transfer: "Virement",
  card: "Carte bancaire",
  other: "Autre",
} as const;
export type PaymentMethod = keyof typeof PAYMENT_METHOD_LABELS;
export const PAYMENT_METHODS = Object.keys(PAYMENT_METHOD_LABELS) as PaymentMethod[];

export const ROLE_LABELS = { admin: "Administrateur", agent: "Agent de contrôle" } as const;
export type AppRole = keyof typeof ROLE_LABELS;

/** Résultat d'un contrôle d'accès, tel que renvoyé par `control_check`. */
export const CONTROL_OUTCOMES = [
  "authorized",
  "already_inside",
  "expired",
  "upcoming",
  "suspended",
  "no_subscription",
  "not_found",
  "invalid_format",
] as const;
export type ControlOutcome = (typeof CONTROL_OUTCOMES)[number];

export const CONTROL_PRESENTATION: Record<
  ControlOutcome,
  { headline: string; message: string; tone: Tone; allowsEntry: boolean; allowsExit: boolean }
> = {
  authorized: {
    headline: "Entrée autorisée",
    message: "Abonnement valide. Vous pouvez enregistrer l'entrée.",
    tone: "success",
    allowsEntry: true,
    allowsExit: false,
  },
  already_inside: {
    headline: "Déjà à l'intérieur",
    message: "Une entrée est déjà ouverte. Enregistrez la sortie si le sportif quitte le stade.",
    tone: "info",
    allowsEntry: false,
    allowsExit: true,
  },
  expired: {
    headline: "Entrée refusée",
    message: "L'abonnement est expiré. Le sportif doit le renouveler auprès de l'administration.",
    tone: "danger",
    allowsEntry: false,
    allowsExit: false,
  },
  upcoming: {
    headline: "Entrée refusée",
    message: "L'abonnement n'est pas encore valide : sa date de début n'est pas atteinte.",
    tone: "danger",
    allowsEntry: false,
    allowsExit: false,
  },
  suspended: {
    headline: "Entrée refusée",
    message: "L'abonnement est suspendu par l'administration.",
    tone: "danger",
    allowsEntry: false,
    allowsExit: false,
  },
  no_subscription: {
    headline: "Entrée refusée",
    message: "Ce sportif n'a aucun abonnement enregistré.",
    tone: "danger",
    allowsEntry: false,
    allowsExit: false,
  },
  not_found: {
    headline: "Sportif introuvable",
    message: "Aucun sportif n'est enregistré avec ce matricule. Vérifiez la saisie.",
    tone: "warning",
    allowsEntry: false,
    allowsExit: false,
  },
  invalid_format: {
    headline: "Matricule invalide",
    message: "Le matricule comporte 2 lettres suivies de 5 chiffres.",
    tone: "warning",
    allowsEntry: false,
    allowsExit: false,
  },
};
