/**
 * English indefinite-article selection (a/an) by *pronunciation*, not
 * spelling: "an hour", "a university", "an MTA card", "an 8".
 */

/**
 * Vowel-letter words pronounced with an initial consonant sound (/j/ or /w/).
 * Prefix-matched, lowercase.
 */
const A_PREFIXES = [
  "eu", // euro, europe, eulogy, euphemism, eureka…
  "ewe",
  "one",
  "once",
  "ouija",
  "ubiq", // ubiquitous
  "unanim", // unanimous
  "use",
  "user",
  "usu", // usual, usurper
  "utensil",
  "uterus",
  "utili", // utility, utilize
  "utopia",
  "uran", // uranium, uranus
  "uv", // uvula
] as const;

/**
 * `uni…` is /juː/ (university, unicorn) EXCEPT when the prefix is the
 * negative `un-` + i… (unimportant, uninvited): those start with a vowel
 * sound.
 */
const UNI_NEGATIVE = /^un(im|in)/;

/** Consonant-letter words with a silent initial `h`. Prefix-matched. */
const AN_PREFIXES = [
  "heir", // heir, heiress, heirloom
  "honest",
  "honor",
  "honour",
  "hour", // hour, hourly, hourglass
] as const;

/**
 * Letters whose English names start with a vowel sound — an F ("ef"),
 * an M ("em"), an X ("ex") — for acronyms and single letters.
 */
const VOWEL_NAMED_LETTERS = new Set([..."AEFHILMNORSX"]);

const VOWELS = new Set([..."aeiou"]);

function isAcronym(word: string): boolean {
  return /^[A-Z][A-Z0-9]+$/.test(word) || /^[A-Z]$/.test(word);
}

/**
 * Spoken English for a leading number: 8… → "eight…" (an); 11 → "eleven",
 * 18 → "eighteen" (an); everything else starts with a consonant sound.
 */
function digitTakesAn(word: string): boolean {
  const digits = /^\d+/.exec(word)?.[0] ?? "";
  return digits.startsWith("8") || digits === "11" || digits === "18";
}

/**
 * Pick `"a"` or `"an"` for the word that follows the article.
 *
 * Handles regular words, silent-h words, /juː/-initial vowel spellings,
 * acronyms/single letters (by letter name) and leading digits (by spoken
 * form).
 */
export function indefiniteArticle(nextWord: string): "a" | "an" {
  if (nextWord.length === 0) return "a";
  if (/^\d/.test(nextWord)) return digitTakesAn(nextWord) ? "an" : "a";
  if (isAcronym(nextWord)) {
    return VOWEL_NAMED_LETTERS.has(nextWord[0] as string) ? "an" : "a";
  }
  const lower = nextWord.toLowerCase();
  if (AN_PREFIXES.some((p) => lower.startsWith(p))) return "an";
  if (lower.startsWith("uni")) return UNI_NEGATIVE.test(lower) ? "an" : "a";
  if (A_PREFIXES.some((p) => lower.startsWith(p))) return "a";
  return VOWELS.has(lower[0] as string) ? "an" : "a";
}
