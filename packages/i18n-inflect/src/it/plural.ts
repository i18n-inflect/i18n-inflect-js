import type { ItGender } from "./articles.js";

/**
 * Italian pluralization.
 *
 * The endings are simple — `-o` → `-i`, `-a` → `-e`, `-e` → `-i` — but the
 * spelling has to keep the consonant sound: `amico` is pronounced with /k/,
 * so its plural is written `amici`… except that `fuoco` keeps the /k/ and is
 * written `fuochi`. Where the sound genuinely varies, the word decides, so
 * this ships the productive rule and the closed list of words that break it.
 */

/** `-co`/`-go` nouns that keep the hard sound: `fuoco` → `fuochi`. */
const HARD_CO_GO = new Set([
  "fuoco",
  "gioco",
  "luogo",
  "albergo",
  "lago",
  "obbligo",
  "dialogo",
  "catalogo",
  "sindaco",
  "carico",
  "banco",
  "bosco",
  "disco",
  "fresco",
  "parco",
  "porco",
  "tedesco",
  "buco",
]);

/** Nouns whose singular and plural are identical. */
const INVARIANT = new Set([
  "città",
  "università",
  "caffè",
  "tè",
  "film",
  "sport",
  "bar",
  "computer",
  "gas",
  "crisi",
  "analisi",
  "tesi",
  "serie",
  "specie",
  "re",
  "gru",
  "virtù",
  "foto",
  "auto",
  "moto",
  "radio",
  "cinema",
]);

/** Masculine nouns with a feminine plural in `-a`: `il braccio` → `le braccia`. */
const FEMININE_PLURAL: Record<string, string> = {
  braccio: "braccia",
  dito: "dita",
  ginocchio: "ginocchia",
  labbro: "labbra",
  lenzuolo: "lenzuola",
  osso: "ossa",
  uovo: "uova",
  paio: "paia",
  uomo: "uomini",
};

/** Pluralize an Italian noun. */
export function pluralize(word: string, gender: ItGender = "masculine"): string {
  const lower = word.toLowerCase();
  if (INVARIANT.has(lower)) return word;
  const irregular = FEMININE_PLURAL[lower];
  if (irregular) return irregular;
  // Stressed final vowels and consonant finals never change: città, sport.
  if (/[àèéìòù]$/.test(lower) || !/[aeiou]$/.test(lower)) return word;

  if (lower.endsWith("io")) {
    // `-io` collapses into one i unless the i carries the stress (zio → zii).
    return /[bcdfglmnprstvz]io$/.test(lower) && !/[zt]io$/.test(lower)
      ? `${word.slice(0, -2)}i`
      : `${word.slice(0, -1)}i`;
  }
  if (lower.endsWith("co") || lower.endsWith("go")) {
    const hard = HARD_CO_GO.has(lower) || /[^aeiou][cg]o$/.test(lower);
    return hard ? `${word.slice(0, -1)}hi` : `${word.slice(0, -1)}i`;
  }
  if (lower.endsWith("ca") || lower.endsWith("ga")) return `${word.slice(0, -1)}he`;
  if (lower.endsWith("cia") || lower.endsWith("gia")) {
    // A vowel before the c/g keeps the i: camicia → camicie, but pioggia → piogge.
    return /[aeiou][cg]ia$/.test(lower) ? `${word.slice(0, -1)}e` : `${word.slice(0, -2)}e`;
  }
  if (lower.endsWith("a")) return `${word.slice(0, -1)}e`;
  return `${word.slice(0, -1)}i`;
}
