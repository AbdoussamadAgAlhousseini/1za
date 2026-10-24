/**
 * Matricule d'un sportif : initiale du prénom + initiale du nom + cinq premiers
 * chiffres du numéro de téléphone. Exemple fictif : AD76214.
 *
 * Le matricule est préparé HORS de l'application. Celle-ci ne reçoit jamais
 * le nom, le prénom ou le téléphone et ne propose aucun moyen de les retrouver.
 */

export const MATRICULE_LENGTH = 7;
export const MATRICULE_PATTERN = /^[A-Z]{2}[0-9]{5}$/;
export const MATRICULE_EXAMPLE = "AD76214";

/**
 * Normalisation appliquée avant toute validation :
 * - suppression des accents (É → E) ;
 * - suppression des espaces, points et tirets ;
 * - passage en majuscules.
 *
 * La base de données applique la même règle (hors accents) et rejette tout
 * matricule non conforme : la validation client n'est qu'un confort.
 */
export function normalizeMatricule(input: string): string {
  return input
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[\s.\-]/g, "")
    .toUpperCase();
}

export function isValidMatricule(value: string): boolean {
  return MATRICULE_PATTERN.test(value);
}

/** Message d'aide précis lorsque la saisie est incorrecte, sinon `null`. */
export function explainMatriculeError(raw: string): string | null {
  const value = normalizeMatricule(raw);
  if (value.length === 0) return "Saisissez un matricule.";
  if (isValidMatricule(value)) return null;

  const letters = value.slice(0, 2);
  const digits = value.slice(2);

  if (!/^[A-Z]{2}$/.test(letters)) {
    return "Le matricule commence par deux lettres (initiales du prénom puis du nom).";
  }
  if (/[^0-9]/.test(digits)) {
    return "Après les deux lettres, le matricule ne contient que des chiffres.";
  }
  if (value.length < MATRICULE_LENGTH) {
    return `Il manque ${MATRICULE_LENGTH - value.length} caractère(s) : 2 lettres suivies de 5 chiffres.`;
  }
  return "Le matricule comporte exactement 7 caractères : 2 lettres suivies de 5 chiffres.";
}

/**
 * Affichage aéré pour la lecture à l'écran (« AD 76214 »). La valeur stockée
 * et transmise reste toujours la forme compacte.
 */
export function formatMatricule(value: string): string {
  return isValidMatricule(value) ? `${value.slice(0, 2)} ${value.slice(2)}` : value;
}

/**
 * Version masquée pour les contextes où le matricule complet n'est pas utile
 * (journaux techniques, notifications) : « AD•••14 ».
 */
export function maskMatricule(value: string): string {
  if (!isValidMatricule(value)) return "•••••••";
  return `${value.slice(0, 2)}•••${value.slice(5)}`;
}
