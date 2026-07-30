/**
 * Hungarian stem alternations, driven by per-lemma flags from the generated
 * lexicon (see `exceptions.gen.ts`).
 *
 * Flag semantics:
 * - `lowering`  — linking vowel is a/e instead of o/e/ö in the accusative
 *   and plural (ház → házat, házak; föld → földet).
 * - `fleeting`  — "hangkivető": the stem drops its last vowel before
 *   vowel-initial suffixes (bokor → bokr-ot); stores the alternate stem.
 * - `vStem`     — v-stems (ló → lov-at); stores the alternate stem. Applies
 *   before vowel-initial (linking) suffixes only: lóval, lóhoz keep `ló`.
 * - `shortening`— the stem vowel shortens before linking suffixes
 *   (kéz → kez-et); stores the alternate stem. Unlike fleeting/v-stems it
 *   does NOT apply to the superessive (vízen, kézen, úton).
 *
 * All alternate-stem flags imply lowered linking vowels (lovat, kezet,
 * hidat), which matches the overwhelming pattern in UniMorph.
 */
export interface StemFlags {
  /**
   * Lowered linking vowel (a/e). Not always uniform across the paradigm:
   * ház → házat AND házak (`"both"`), but olaj → olajat yet olajok
   * (`"accusative"`); the pipeline picks the narrowest value that fits.
   */
  lowering?: "both" | "accusative" | "plural";
  fleeting?: string;
  vStem?: string;
  shortening?: string;
  /**
   * Lexical harmony override. Compounds harmonize with their final member
   * (forrásvíz → forrásvíznek despite the back á), and mixed a–e words are
   * lexically back (haver → haverok) — neither is derivable from the letters.
   */
  harmony?: "back" | "front";
  /**
   * Third-person possessive takes `-ja/-je` rather than `-a/-e`: kalapja,
   * kertje, but háza, asztala. Purely lexical — nothing in the shape of the
   * word predicts it.
   */
  possessiveJ?: boolean;
  /**
   * Vowel-final lemma whose plural nevertheless takes a linking vowel:
   * thai → thai-o-k. (The lowered counterpart, vietnámi → vietnámi-a-k,
   * is expressed as `lowering: "plural"` on a vowel-final lemma.)
   */
  vowelPlural?: "linking";
}

/** Which suffix family is being attached (drives stem choice). */
export type SuffixKind =
  /** Vowel-initial linking suffixes: accusative, plural. */
  | "linking"
  /** Superessive `-on/-en/-ön`: fleeting + v-stems apply, shortening doesn't. */
  | "superessive"
  /** Consonant-initial suffixes (-nak, -ban, -hoz, …) and v-assimilating ones. */
  | "plain";

/** Choose the stem variant for a suffix family. */
export function stemFor(lemma: string, flags: StemFlags | undefined, kind: SuffixKind): string {
  if (!flags) return lemma;
  switch (kind) {
    case "linking":
      return flags.fleeting ?? flags.vStem ?? flags.shortening ?? lemma;
    case "superessive":
      return flags.fleeting ?? flags.vStem ?? lemma;
    case "plain":
      return lemma;
  }
}

/**
 * True when the linking vowel is lowered (a/e) in the given paradigm slot.
 * v-stems and shortening stems always lower (lovat, kezet); fleeting stems
 * only when explicitly flagged (bokrot vs. sátrat).
 */
export function isLoweredFor(flags: StemFlags | undefined, slot: "accusative" | "plural"): boolean {
  if (!flags) return false;
  if (flags.vStem !== undefined || flags.shortening !== undefined) return true;
  return flags.lowering === "both" || flags.lowering === slot;
}
