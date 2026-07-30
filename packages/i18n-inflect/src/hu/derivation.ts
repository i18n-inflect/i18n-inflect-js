import type { StemFlags } from "./stems.js";

/**
 * Word formation, as opposed to inflection.
 *
 * Inflection puts a word into a syntactic role; derivation makes a different
 * word out of it. Hungarian's `-i` suffix turns a noun into the adjective
 * "belonging to / coming from" it: Budapest → budapesti, ma → mai,
 * iskola → iskolai.
 */

/**
 * The relational adjective of a Hungarian noun.
 *
 * Three rules cover it:
 * - a word already ending in `i` absorbs the suffix (Helsinki → helsinki);
 * - other vowel-final words simply take `-i`, and — unlike every case
 *   suffix — do **not** lengthen a final a/e (Kanada → kanadai, never
 *   *kanadái*);
 * - consonant-final words take `-i` on their fleeting stem when they have
 *   one (Eger → egri), otherwise on the lemma (Szeged → szegedi).
 *
 * The result is lowercased: the derived adjective is a common word even
 * when the noun was a proper name.
 */
export function relationalAdjective(word: string, flags?: StemFlags): string {
  const lower = word.toLowerCase();
  const irregular = IRREGULAR[lower];
  if (irregular) return irregular;
  if (lower.endsWith("i") || lower.endsWith("í")) return lower;
  return `${flags?.fleeting ?? lower}i`;
}

/**
 * Words whose relational adjective is not derivable from the lemma. Kept
 * deliberately short: these are lexical facts, not a pattern, so the list
 * grows only when a real form turns out wrong.
 */
const IRREGULAR: Record<string, string> = {
  eger: "egri", // the city; the fleeting stem is invisible in the lemma
  falu: "falusi",
};

/**
 * How the derived adjective itself inflects. It ends in `-i`, and such
 * words take a linking vowel in the plural rather than lengthening
 * (budapesti → budapestiek, kanadai → kanadaiak).
 */
export const RELATIONAL_FLAGS: StemFlags = { lowering: "plural" };
