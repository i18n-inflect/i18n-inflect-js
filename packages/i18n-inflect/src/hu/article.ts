import { VOWELS } from "./phonology.js";

/**
 * Hungarian definite article selection (a/az) by *pronunciation*:
 * "az alma", "a ház" — and, because the choice tracks the spoken form,
 * "az 5" (öt) vs "a 6" (hat), "az MTA" (em-té-a), "a BKV" (bé-ká-vé).
 */

/**
 * Letters whose Hungarian names start with a vowel sound: vowels themselves
 * plus the consonants named with a leading e (ef, el, em, en, er, es) and
 * x/y (iksz, ipszilon). Used for acronyms and single letters.
 */
const VOWEL_NAMED_LETTERS = new Set([..."AÁEÉIÍOÓÖŐUÚÜŰFLMNRSXY"]);

/** Leading symbols with vowel-initial spoken forms (€ → "euró", & → "és"). */
const VOWEL_SYMBOLS = new Set(["€", "&"]);
const CONSONANT_SYMBOLS = new Set(["$", "£", "%", "@", "#", "+", "-", "−", "*"]);

/**
 * Spoken form of a leading integer starts with a vowel when:
 * - the leading digit is 5 (öt, ötven, ötszáz, ötezer…), or
 * - the leading digit is 1 and the digit count means egy/ezer/egymillió/…
 *   (1, 1 000, 1 000 000 → "egy…"/"ezer…": magnitude divisible by 3),
 *   but NOT tíz/száz/tízezer/… (10, 100, 10 000 → consonant t/sz).
 */
function digitTakesAz(token: string): boolean {
  const digits = /^\d+/.exec(token)?.[0] ?? "";
  const lead = digits[0];
  if (lead === "5") return true;
  if (lead === "1") return (digits.length - 1) % 3 === 0;
  return false;
}

function isAcronym(token: string): boolean {
  // Two or more capitals (optionally with digits), or a single capital letter.
  return /^[A-ZÁÉÍÓÖŐÚÜŰ]{2,}[0-9]*$/.test(token) || /^[A-ZÁÉÍÓÖŐÚÜŰ]$/.test(token);
}

/**
 * Pick `"a"` or `"az"` for the word that follows the article.
 *
 * Handles ordinary words (initial letter), leading digits (spoken number),
 * acronyms and single letters (letter names) and a few symbols.
 */
export function definiteArticle(nextWord: string): "a" | "az" {
  // A hyphenated suffix is pronounced after the base, so the base decides:
  // "az MTA-ban", "a 6-ot", "az e-mail".
  const base = nextWord.split("-", 1)[0];
  if (base !== undefined && base.length > 0) nextWord = base;
  const first = nextWord[0];
  if (first === undefined) return "a";
  if (/\d/.test(first)) return digitTakesAz(nextWord) ? "az" : "a";
  if (VOWEL_SYMBOLS.has(first)) return "az";
  if (CONSONANT_SYMBOLS.has(first)) return "a";
  if (isAcronym(nextWord)) return VOWEL_NAMED_LETTERS.has(first) ? "az" : "a";
  return VOWELS.includes(first.toLowerCase()) ? "az" : "a";
}
