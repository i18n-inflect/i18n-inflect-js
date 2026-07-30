import type { StemFlags } from "./stems.js";
import { inflectNounParts } from "./suffixes.js";
import type { HuCase } from "./tags.js";

/**
 * Suffixing digits and acronyms — "6-ot", "5-tel", "1000-rel", "SMS-t",
 * "MTA-ban".
 *
 * Hungarian attaches these suffixes to the *spoken* form and writes them
 * after a hyphen, so this is not a machine-learning problem at all: spell
 * the relevant part of the number (or the last letter's name), run it
 * through the ordinary suffix engine, and write the digits plus the suffix
 * the engine appended.
 *
 * Only the final constituent of a number matters phonologically — 2026 ends
 * in "hat", 1500 in "száz" — so the speller resolves just that tail.
 */

/** Unit words, indexed by digit. */
const UNITS = ["", "egy", "kettő", "három", "négy", "öt", "hat", "hét", "nyolc", "kilenc"] as const;

/** Tens words, indexed by the digit in the tens place. */
const TENS = [
  "",
  "tíz",
  "húsz",
  "harminc",
  "negyven",
  "ötven",
  "hatvan",
  "hetven",
  "nyolcvan",
  "kilencven",
] as const;

/**
 * Stem behavior of the numeral words. Numerals are a closed class, so this
 * table is hand-written (never generated): hét → hetet, tíz → tizet,
 * három → hármat, ezer → ezret, and the many lowering stems (nyolcat,
 * százat, ötvenet).
 */
const NUMERAL_FLAGS: ReadonlyMap<string, StemFlags> = new Map<string, StemFlags>([
  ["három", { fleeting: "hárm", lowering: "both" }],
  ["hét", { shortening: "het" }],
  ["nyolc", { lowering: "both" }],
  ["tíz", { shortening: "tiz" }],
  ["húsz", { lowering: "both" }],
  ["harminc", { lowering: "both" }],
  ["negyven", { lowering: "both" }],
  ["ötven", { lowering: "both" }],
  ["hatvan", { lowering: "both" }],
  ["hetven", { lowering: "both" }],
  ["nyolcvan", { lowering: "both" }],
  ["kilencven", { lowering: "both" }],
  ["száz", { lowering: "both" }],
  ["ezer", { fleeting: "ezr" }],
]);

/**
 * Hungarian letter names — what an initialism is read as. Only the final
 * letter matters for suffixation, so `W` maps to its phonological tail.
 */
const LETTER_NAMES: Record<string, string> = {
  A: "á",
  Á: "á",
  B: "bé",
  C: "cé",
  D: "dé",
  E: "é",
  É: "é",
  F: "ef",
  G: "gé",
  H: "há",
  I: "i",
  Í: "í",
  J: "jé",
  K: "ká",
  L: "el",
  M: "em",
  N: "en",
  O: "ó",
  Ó: "ó",
  Ö: "ő",
  Ő: "ő",
  P: "pé",
  Q: "kú",
  R: "er",
  S: "es",
  T: "té",
  U: "ú",
  Ú: "ú",
  Ü: "ű",
  Ű: "ű",
  V: "vé",
  W: "vé", // "dupla vé" — only the tail matters here
  X: "iksz",
  Y: "ipszilon",
  Z: "zé",
};

/**
 * The spoken form of a number's final constituent: 6 → "hat", 10 → "tíz",
 * 100 → "száz", 2026 → "hat", 1500 → "száz", 1000000 → "millió".
 *
 * Returns `undefined` for anything that is not a plain digit string.
 */
export function numeralTail(digits: string): string | undefined {
  if (!/^\d+$/.test(digits)) return undefined;
  const trimmed = digits.replace(/^0+(?=\d)/, "");
  if (/^0+$/.test(trimmed)) return "nulla";
  let zeros = 0;
  for (let i = trimmed.length - 1; i >= 0 && trimmed[i] === "0"; i--) zeros++;
  const lastNonZero = Number(trimmed[trimmed.length - 1 - zeros]);
  if (zeros === 0) return UNITS[lastNonZero];
  if (zeros === 1) return TENS[lastNonZero];
  if (zeros === 2) return "száz";
  if (zeros <= 5) return "ezer"; // ezer, tízezer, százezer
  if (zeros <= 8) return "millió";
  if (zeros <= 11) return "milliárd";
  return "billió";
}

/**
 * Symbols are read aloud too, and the suffix follows that reading:
 * 15% is "tizenöt százalék", so it takes -kal (AkH. 82. f).
 */
const SYMBOL_READINGS: Record<string, string> = {
  "%": "százalék",
  "‰": "ezrelék",
  "€": "euró",
  $: "dollár",
  "£": "font",
  "°": "fok",
  "+": "plusz",
  "&": "és",
  "@": "kukac",
};

/** True for initialisms read letter by letter (MTA, SMS, BKV). */
function isInitialism(token: string): boolean {
  return /^[A-ZÁÉÍÓÖŐÚÜŰ]{2,}$/.test(token);
}

/**
 * The spoken tail of a token that carries hyphenated suffixes: a digit
 * string's final numeral word, or an initialism's final letter name.
 * `undefined` when the token is an ordinary word.
 */
export function spokenTailOf(token: string): string | undefined {
  const symbol = SYMBOL_READINGS[token.at(-1) as string];
  if (symbol !== undefined && token.length > 1) return symbol;
  const digits = numeralTail(token);
  if (digits !== undefined) return digits;
  if (isInitialism(token)) return LETTER_NAMES[token.at(-1) as string];
  return undefined;
}

/**
 * Suffix a digit string or initialism: `hyphenatedForm("6", false,
 * "accusative")` → `"6-ot"`.
 *
 * Returns `undefined` when the token is not a digit string or initialism,
 * and the bare token when no suffix is requested.
 *
 * Known limitation: initialisms read as words rather than letter by letter
 * (MÁV, ELTE) get the letter-name reading. Seed the oracle cache for those.
 */
export function hyphenatedForm(
  token: string,
  plural: boolean,
  huCase: HuCase | undefined,
): string | undefined {
  const spoken = spokenTailOf(token);
  if (spoken === undefined) return undefined;
  const parts = inflectNounParts(spoken, NUMERAL_FLAGS.get(spoken), plural, huCase);
  if (parts.suffix.length === 0) return token;
  return `${token}-${parts.suffix}`;
}
