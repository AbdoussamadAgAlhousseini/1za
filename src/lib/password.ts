/**
 * Génère un mot de passe temporaire lisible (sans caractères ambigus 0/O, 1/l/I)
 * respectant la politique : minuscules, majuscules et chiffres.
 */
const LOWER = "abcdefghijkmnpqrstuvwxyz";
const UPPER = "ABCDEFGHJKLMNPQRSTUVWXYZ";
const DIGITS = "23456789";

function pick(alphabet: string, n: number): string[] {
  const bytes = new Uint32Array(n);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => alphabet[b % alphabet.length] ?? "a");
}

export function generatePassword(length = 12): string {
  const chars = [...pick(UPPER, 2), ...pick(DIGITS, 3), ...pick(LOWER, Math.max(5, length - 5))];
  const order = new Uint32Array(chars.length);
  crypto.getRandomValues(order);
  const shuffled = chars.map((c, i) => ({ c, k: order[i] ?? 0 })).sort((a, b) => a.k - b.k).map((x) => x.c);
  // Groupes de 4 pour faciliter la dictée : « Kd7m-qR3x-a9pt ».
  return shuffled.join("").replace(/(.{4})(?=.)/g, "$1-");
}
