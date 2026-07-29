/**
 * French elision: `le`/`la`/`de` become `l'`/`d'` before a vowel or mute h —
 * unless the word begins with an *h aspiré*, which blocks elision
 * ("le haricot", never "l'haricot").
 */

/**
 * Common h-aspiré word stems (prefix-matched, lowercase). Curated from
 * standard dictionaries; extend via the data pipeline if gaps show up.
 */
const H_ASPIRE_PREFIXES = [
  "hach", // hache, hacher
  "haie",
  "haine",
  "hair", // haïr (unaccented fold)
  "haïss",
  "hall",
  "halo",
  "halte",
  "hamac",
  "hamburger",
  "hameau",
  "hamster",
  "hanche",
  "handicap",
  "hangar",
  "hanter",
  "harcel",
  "hard",
  "hareng",
  "hargne",
  "haricot",
  "harnais",
  "harpe",
  "hasard",
  "hât", // hâte
  "hauss", // hausse
  "haut",
  "havre",
  "hérisson",
  "héron",
  "héros", // but: l'héroïne — prefix stops at "héros"
  "hêtre",
  "heurt",
  "hibou",
  "hiérarch",
  "hip-hop",
  "hippie",
  "hockey",
  "hollande",
  "homard",
  "hongr", // Hongrie, hongrois
  "honte",
  "hoquet",
  "hors",
  "hot-dog",
  "houblon",
  "houle",
  "housse",
  "huche",
  "huit", // le huit, le huitième
  "hurl", // hurler, hurlement
  "hussard",
  "hutte",
] as const;

const VOWELS = new Set([..."aàâäeéèêëiîïoôöœuùûüyAÀÂÄEÉÈÊËIÎÏOÔÖŒUÙÛÜY"]);

/** True when `word` starts with an h aspiré (blocks elision and liaison). */
export function isHAspire(word: string): boolean {
  const lower = word.toLowerCase();
  return H_ASPIRE_PREFIXES.some((p) => lower.startsWith(p));
}

/**
 * True when the article before `word` elides: the word starts with a vowel,
 * or with a mute `h` (i.e. an `h` that is not aspiré). `y` is treated as a
 * consonant ("le yaourt").
 */
export function elides(word: string): boolean {
  const first = word[0];
  if (first === undefined) return false;
  if (first === "y" || first === "Y") return false;
  if (VOWELS.has(first)) return true;
  if (first === "h" || first === "H") return !isHAspire(word);
  return false;
}
