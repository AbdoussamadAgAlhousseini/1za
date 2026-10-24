/**
 * Identifiants de connexion.
 *
 * - Agent : numéro de téléphone + mot de passe.
 * - Administrateur : mot de passe seul.
 *
 * Supabase Auth exige un identifiant : chaque compte reçoit une adresse
 * TECHNIQUE sur le domaine réservé « .invalid » (RFC 2606), qui ne peut
 * recevoir aucun message. Elle n'est jamais affichée aux utilisateurs.
 *
 * ⚠ Ces constantes sont dupliquées dans scripts/admin-account.mjs et
 * scripts/seed-dev.mjs : les garder synchronisées.
 */

export const LOGIN_EMAIL_DOMAIN = "stade26.invalid";
export const ADMIN_LOGIN_EMAIL = `administration@${LOGIN_EMAIL_DOMAIN}`;
export const DEFAULT_COUNTRY_CODE = "223"; // Mali

/**
 * Normalise un numéro saisi (« 76 12 34 56 », « +223 76123456 »,
 * « 0022376123456 ») en chiffres avec indicatif : « 22376123456 ».
 * Renvoie `null` si le numéro est invalide.
 */
export function normalizePhone(input: string): string | null {
  let digits = input.replace(/[^\d+]/g, "");
  if (digits.startsWith("+")) digits = digits.slice(1);
  else if (digits.startsWith("00")) digits = digits.slice(2);
  digits = digits.replace(/\D/g, "");
  if (digits.length === 8) digits = `${DEFAULT_COUNTRY_CODE}${digits}`;
  if (!/^[0-9]{10,15}$/.test(digits)) return null;
  return digits;
}

export function agentLoginEmail(normalizedPhone: string): string {
  return `agent.${normalizedPhone}@${LOGIN_EMAIL_DOMAIN}`;
}

/** Affichage : « +223 76 12 34 56 ». */
export function formatPhone(normalized: string | null | undefined): string {
  if (!normalized) return "—";
  if (normalized.startsWith(DEFAULT_COUNTRY_CODE) && normalized.length === 11) {
    const local = normalized.slice(3);
    return `+${DEFAULT_COUNTRY_CODE} ${local.replace(/(\d{2})(?=\d)/g, "$1 ")}`;
  }
  return `+${normalized}`;
}
