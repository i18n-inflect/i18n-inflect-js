/**
 * Hungarian phonology helpers: vowel inventory, vowel harmony and a
 * digraph-aware view of the final consonant.
 *
 * Terminology used across the Hungarian modules:
 * - *back* vowels: a á o ó u ú
 * - *front* vowels: e ö ő ü ű (harmonically active)
 * - *neutral* vowels: i í é (transparent to harmony)
 *
 * Suffixes come in two-form (`-nak/-nek`) and three-form
 * (`-hoz/-hez/-höz`, linking vowels `-o-/-e-/-ö-`) alternations:
 * the two-form axis is decided by {@link harmonyOf}, the rounded third form
 * by {@link hasRoundedFinalVowel}.
 */

export const VOWELS = "aáeéiíoóöőuúüű";
const BACK_VOWELS = new Set([..."aáoóuú"]);
const NEUTRAL_VOWELS = new Set([..."iíé"]);

/**
 * All-neutral-vowel lemmas that nevertheless take back suffixes
 * (híd → hídhoz, cél → célhoz). Seed list for the classic closed class; the
 * data pipeline extends it from UniMorph diffs.
 */
export const BACK_NEUTRAL_LEMMAS = new Set([
  "cél",
  "csík",
  "derék",
  "díj",
  "férfi",
  "gyík",
  "héj",
  "híd",
  "íj",
  "ín",
  "kín",
  "nyíl",
  "sír",
  "zsír",
]);

/** The vowels of a word, in order, lowercased. */
export function vowelsOf(word: string): string[] {
  return [...word.toLowerCase()].filter((ch) => VOWELS.includes(ch));
}

/** True when the word's last letter is a vowel. */
export function endsInVowel(word: string): boolean {
  const last = word.at(-1)?.toLowerCase();
  return last !== undefined && VOWELS.includes(last);
}

/**
 * Two-form harmony class: which of `-nak/-nek` a word takes.
 *
 * Scans vowels right to left; the last non-neutral vowel decides. Words with
 * only neutral vowels are front by default, unless listed in
 * {@link BACK_NEUTRAL_LEMMAS} (or in the generated lexicon's back set,
 * checked by the caller).
 */
export function harmonyOf(word: string, extraBackLemmas?: ReadonlySet<string>): "back" | "front" {
  const lower = word.toLowerCase();
  if (BACK_NEUTRAL_LEMMAS.has(lower) || extraBackLemmas?.has(lower)) return "back";
  const vowels = vowelsOf(lower);
  for (let i = vowels.length - 1; i >= 0; i--) {
    const v = vowels[i] as string;
    if (NEUTRAL_VOWELS.has(v)) continue;
    return BACK_VOWELS.has(v) ? "back" : "front";
  }
  return "front";
}

/** True when the last vowel is front rounded (ö ő ü ű) → `-höz`/`-ön`/`-öt`. */
export function hasRoundedFinalVowel(word: string): boolean {
  const vowels = vowelsOf(word);
  const last = vowels.at(-1);
  return last !== undefined && "öőüű".includes(last);
}

/** Hungarian multi-letter consonant graphemes, longest first. */
const CONSONANT_GRAPHEMES = ["dzs", "cs", "dz", "gy", "ly", "ny", "sz", "ty", "zs"] as const;

/** The word's final consonant grapheme, with gemination detected. */
export interface FinalConsonant {
  /** The single grapheme, e.g. `"z"`, `"sz"`, `"dzs"`. */
  grapheme: string;
  /** True for written geminates: `toll` (ll), `hossz` (ssz). */
  geminate: boolean;
}

/**
 * Identify the final consonant grapheme of a word, respecting digraphs and
 * their doubled written forms (`ssz` = geminate `sz`). Returns `undefined`
 * for vowel-final words.
 */
export function finalConsonantOf(word: string): FinalConsonant | undefined {
  const lower = word.toLowerCase();
  if (lower.length === 0 || endsInVowel(lower)) return undefined;
  for (const g of CONSONANT_GRAPHEMES) {
    if (lower.endsWith(g)) {
      // Geminate digraph doubles its first letter: sz → ssz, gy → ggy.
      const geminateWritten = (g[0] as string) + g;
      return { grapheme: g, geminate: lower.endsWith(geminateWritten) };
    }
  }
  const last = lower.at(-1) as string;
  return { grapheme: last, geminate: lower.endsWith(last + last) };
}
