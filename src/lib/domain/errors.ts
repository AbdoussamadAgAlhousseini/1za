/**
 * Codes d'erreur métier renvoyés par les fonctions PostgreSQL (« ERR_… ») et
 * leur traduction pour les utilisateurs. Aucun détail technique n'est exposé.
 */
export const ERROR_MESSAGES = {
  ERR_FORBIDDEN: "Vous n'avez pas l'autorisation d'effectuer cette opération.",
  ERR_RATE_LIMITED: "Trop d'opérations en peu de temps. Patientez quelques secondes puis réessayez.",
  ERR_MATRICULE_FORMAT: "Matricule invalide : 2 lettres suivies de 5 chiffres (ex. AD76214).",
  ERR_MATRICULE_DUPLICATE:
    "Ce matricule est déjà attribué à un autre sportif. Aucun enregistrement n'a été créé : appliquez la procédure de résolution des doublons.",
  ERR_DATE_FUTURE: "La date ne peut pas être postérieure à aujourd'hui.",
  ERR_DATE_INVALID: "Les dates saisies sont incohérentes ou hors de la plage autorisée.",
  ERR_ATHLETE_NOT_FOUND: "Aucun sportif ne correspond à ce matricule.",
  ERR_PLAN_NOT_FOUND: "Formule d'abonnement introuvable.",
  ERR_PLAN_INACTIVE: "Cette formule est désactivée et ne peut plus être vendue.",
  ERR_PLAN_DUPLICATE: "Une formule porte déjà ce nom.",
  ERR_SUBSCRIPTION_NOT_FOUND: "Abonnement introuvable.",
  ERR_SUBSCRIPTION_OVERLAP:
    "Ces dates chevauchent un autre abonnement de ce sportif. Choisissez une date de début postérieure à la fin de l'abonnement existant.",
  ERR_SUBSCRIPTION_INVALID: "Entrée refusée : aucun abonnement valide aujourd'hui.",
  ERR_ALREADY_INSIDE: "Une entrée est déjà ouverte pour ce sportif. Enregistrez d'abord sa sortie.",
  ERR_NO_OPEN_VISIT: "Aucune entrée en cours pour ce sportif : la sortie ne peut pas être enregistrée.",
  ERR_VISIT_NOT_FOUND: "Passage introuvable.",
  ERR_PAYMENT_NOT_FOUND: "Paiement introuvable.",
  ERR_REASON_REQUIRED: "Indiquez un motif (5 à 300 caractères).",
  ERR_INVALID_STATE_TRANSITION: "Cette opération n'est pas possible dans l'état actuel.",
  ERR_INVALID_INPUT: "Certaines informations sont invalides. Vérifiez le formulaire.",
  ERR_SELF_ACTION: "Vous ne pouvez pas effectuer cette opération sur votre propre compte.",
  ERR_PROFILE_EXISTS: "Ce compte possède déjà un profil.",
  ERR_PHONE_DUPLICATE: "Ce numéro de téléphone est déjà utilisé par un autre compte.",
  ERR_USER_NOT_FOUND: "Compte introuvable.",
  ERR_IMMUTABLE: "Cette donnée historique ne peut pas être modifiée.",
} as const;

export type ErrorCode = keyof typeof ERROR_MESSAGES;

export const GENERIC_ERROR_MESSAGE =
  "Une erreur inattendue est survenue. Réessayez ; si le problème persiste, contactez l'administrateur.";

export const NETWORK_ERROR_MESSAGE =
  "Connexion au serveur impossible. Vérifiez la connexion réseau puis réessayez.";

export function isErrorCode(value: unknown): value is ErrorCode {
  return typeof value === "string" && value in ERROR_MESSAGES;
}

/** Extrait le code métier d'une erreur PostgREST / Supabase. */
export function extractErrorCode(error: unknown): ErrorCode | null {
  if (error && typeof error === "object" && "message" in error) {
    const message = (error as { message: unknown }).message;
    if (isErrorCode(message)) return message;
  }
  return null;
}

export function messageForError(error: unknown): string {
  const code = extractErrorCode(error);
  return code ? ERROR_MESSAGES[code] : GENERIC_ERROR_MESSAGE;
}
