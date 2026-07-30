import { lengthenFinalVowel } from "./orthography.js";
import { endsInVowel, harmonyOf, hasRoundedFinalVowel } from "./phonology.js";
import { isLoweredFor, type StemFlags, stemFor } from "./stems.js";

/**
 * Hungarian possessive suffixes — `házam`, `háza`, `házaink`.
 *
 * Two things make these harder than the cases. They attach to the
 * alternating stem, so every stem class shows through (`lovam`, `kezem`,
 * `bokrom`); and the third person has two forms, `-a/-e` and `-ja/-je`,
 * chosen lexically rather than phonologically. Nothing in `ház` versus
 * `kalap` predicts *háza* against *kalapja* — the corpus has to say, which
 * is what the `possessiveJ` flag records.
 */

/** Who owns the thing, and how many of them there are. */
export interface Possessor {
  person: "first" | "second" | "third";
  plural: boolean;
}

type Harmony = "back" | "front";

const two = (h: Harmony, back: string, front: string) => (h === "back" ? back : front);

/** o/e/ö — the three-way harmonic vowel. */
function three(stem: string, h: Harmony): string {
  if (h === "back") return "o";
  return hasRoundedFinalVowel(stem) ? "ö" : "e";
}

/** The linking vowel before -m, -d and -tok; lowered to a/e for some words. */
function linking(stem: string, h: Harmony, lowered: boolean): string {
  return lowered ? two(h, "a", "e") : three(stem, h);
}

/**
 * The second-person plural ending harmonizes twice over: `házatok`,
 * `kertetek`, `gyümölcsötök` — the linking vowel and the vowel inside the
 * ending agree separately, which is why this is not a two-form suffix.
 */
function secondPluralEnding(stem: string, h: Harmony): string {
  return `t${three(stem, h)}k`;
}

/**
 * The third-person stem, which everything else is built on:
 * `háza`, `kalapja`, `almája`, `kezei` all start here.
 */
function thirdPersonBase(stem: string, h: Harmony, vowelFinal: boolean, useJ: boolean): string {
  if (vowelFinal) return `${stem}j${two(h, "a", "e")}`;
  return useJ ? `${stem}j${two(h, "a", "e")}` : stem + two(h, "a", "e");
}

/**
 * Build a possessive form.
 *
 * @param plural whether the possessed thing is plural (házam → házaim)
 */
export function possessiveForm(
  lemma: string,
  flags: StemFlags | undefined,
  possessor: Possessor,
  plural: boolean,
  backSet?: ReadonlySet<string>,
): string {
  const altStem = stemFor(lemma, flags, "linking");
  const vowelFinal = altStem === lemma && endsInVowel(lemma);
  const stem = vowelFinal ? lengthenFinalVowel(lemma) : altStem;
  const h = flags?.harmony ?? harmonyOf(lemma, backSet);
  const useJ = flags?.possessiveJ === true;

  if (plural) {
    // The plural marker is -i on the third-person base: házai, kertjei,
    // almái — and the person endings ride on top of that.
    const base = vowelFinal ? `${stem}i` : `${thirdPersonBase(stem, h, false, useJ)}i`;
    switch (possessor.person) {
      case "first":
        return possessor.plural ? `${base}nk` : `${base}m`;
      case "second":
        return possessor.plural ? base + two(h, "tok", "tek") : `${base}d`;
      case "third":
        return possessor.plural ? `${base}k` : base;
    }
  }

  const lowered = isLoweredFor(flags, "accusative");
  const link = vowelFinal ? "" : linking(stem, h, lowered);
  switch (possessor.person) {
    case "first":
      // A vowel-final stem takes a bare -nk: almánk, not *almáunk.
      if (!possessor.plural) return `${stem + link}m`;
      return vowelFinal ? `${stem}nk` : stem + two(h, "unk", "ünk");
    case "second":
      return possessor.plural ? stem + link + secondPluralEnding(stem, h) : `${stem + link}d`;
    case "third": {
      const base = thirdPersonBase(stem, h, vowelFinal, useJ);
      return possessor.plural ? base.slice(0, -1) + two(h, "uk", "ük") : base;
    }
  }
}
