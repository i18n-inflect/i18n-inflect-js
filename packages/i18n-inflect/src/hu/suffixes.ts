import { assimilatingParts, lengthenFinalVowel } from "./orthography.js";
import { endsInVowel, finalConsonantOf, harmonyOf, hasRoundedFinalVowel } from "./phonology.js";
import { isLoweredFor, type StemFlags, stemFor } from "./stems.js";
import type { HuCase } from "./tags.js";

/**
 * The Hungarian noun suffix engine.
 *
 * Suffix chain: stem → plural (`-k`) → case. Handles vowel harmony
 * (two- and three-form suffixes), final a/e lengthening, linking-vowel
 * selection with lowering, stem alternations (via {@link StemFlags}) and
 * full v-assimilation for `-val/-vel` and `-vá/-vé`.
 *
 * Every builder comes in a `…Parts` variant returning the stem and the
 * appended suffix separately. That split is what lets digits and acronyms
 * be suffixed with a hyphen after their *spoken* form — "6-ot" is `6` plus
 * the suffix of "hatot" — see `numerals.ts`.
 */

/** A built form, split at the point where the suffix begins. */
export interface InflectedParts {
  /** The stem as it appears in the final form (may be altered). */
  stem: string;
  /** Everything appended to it. */
  suffix: string;
}

/**
 * Nouns ending in an `h` whose pronunciation fluctuates: AkH. 82. e) allows
 * both `dühvel` and `dühhel`, so we write the unassimilated form, which is
 * the one that keeps the word recognizable.
 */
const SILENT_H_NOUNS = new Set(["cseh", "doh", "düh", "éh", "juh", "méh", "oláh", "pléh", "rüh"]);

/** Finals that take the accusative `-t` without a linking vowel (bort, pénzt). */
const BARE_T_FINALS = new Set(["l", "ly", "j", "n", "ny", "r", "s", "sz", "z", "zs"]);

type Harmony = "back" | "front";

function two(h: Harmony, back: string, front: string): string {
  return h === "back" ? back : front;
}

/** Three-form vowel (o/e/ö) for linking vowels, `-on/-en/-ön`, `-hoz/-hez/-höz`. */
function threeVowel(base: string, h: Harmony): string {
  if (h === "back") return "o";
  return hasRoundedFinalVowel(base) ? "ö" : "e";
}

/** Linking vowel before `-t`/`-k`: three-form, or lowered a/e. */
function linkingVowel(base: string, h: Harmony, lowered: boolean): string {
  if (lowered) return two(h, "a", "e");
  return threeVowel(base, h);
}

/** Build the plural (`-k`) form, split into stem and suffix. */
export function pluralParts(
  lemma: string,
  flags: StemFlags | undefined,
  backSet?: ReadonlySet<string>,
): InflectedParts {
  // v-stems are vowel-final lemmas with a consonant-final linking stem
  // (ló → lov-ak), so resolve the stem before the vowel-final shortcut.
  const stem = stemFor(lemma, flags, "linking");
  const h = flags?.harmony ?? harmonyOf(lemma, backSet);
  if (stem === lemma && endsInVowel(lemma)) {
    // Vowel-final lemmas with a linking-vowel plural: thai → thaiok
    // (`vowelPlural`), vietnámi → vietnámiak (`lowering: "plural"`).
    if (flags?.vowelPlural === "linking") {
      return { stem: lemma, suffix: `${threeVowel(lemma, h)}k` };
    }
    if (isLoweredFor(flags, "plural") && !/[aáeé]$/i.test(lemma)) {
      return { stem: lemma, suffix: `${two(h, "a", "e")}k` };
    }
    return { stem: lengthenFinalVowel(lemma), suffix: "k" };
  }
  return { stem, suffix: `${linkingVowel(stem, h, isLoweredFor(flags, "plural"))}k` };
}

/** Build the plural (`-k`) form of a lemma. */
export function pluralForm(
  lemma: string,
  flags: StemFlags | undefined,
  backSet?: ReadonlySet<string>,
): string {
  const parts = pluralParts(lemma, flags, backSet);
  return parts.stem + parts.suffix;
}

interface CaseOptions {
  /** Stem flags of the lemma — omit when `base` is already a plural form. */
  flags?: StemFlags | undefined;
  /** True when `base` is a plural (`-k`) form: linking vowels lower (házakat). */
  pluralBase?: boolean;
  /** Generated back-harmony lemma set (all-neutral-vowel exceptions). */
  backSet?: ReadonlySet<string> | undefined;
}

/** Attach a case suffix to `base`, split into stem and suffix. */
export function applyCaseParts(
  base: string,
  huCase: HuCase,
  opts: CaseOptions = {},
): InflectedParts {
  const { flags, pluralBase = false, backSet } = opts;
  const h = flags?.harmony ?? harmonyOf(base, backSet);
  const vowelFinal = endsInVowel(base);
  const long = lengthenFinalVowel(base); // lengthened variant for vowel-final stems
  const plain = vowelFinal ? long : base;

  switch (huCase) {
    case "accusative": {
      const stem = pluralBase ? base : stemFor(base, flags, "linking");
      if (stem === base && vowelFinal) return { stem: long, suffix: "t" };
      const lowered = pluralBase || isLoweredFor(flags, "accusative");
      const final = finalConsonantOf(stem);
      const bareT =
        !lowered && stem === base && final !== undefined && BARE_T_FINALS.has(final.grapheme);
      if (bareT) return { stem: base, suffix: "t" };
      return { stem, suffix: `${linkingVowel(stem, h, lowered)}t` };
    }
    case "dative":
    case "genitive":
      return { stem: plain, suffix: two(h, "nak", "nek") };
    case "instrumental":
      if (vowelFinal || SILENT_H_NOUNS.has(base.toLowerCase())) {
        return { stem: vowelFinal ? long : base, suffix: two(h, "val", "vel") };
      }
      return assimilatingParts(base, two(h, "al", "el"));
    case "translative":
      if (vowelFinal || SILENT_H_NOUNS.has(base.toLowerCase())) {
        return { stem: vowelFinal ? long : base, suffix: two(h, "vá", "vé") };
      }
      return assimilatingParts(base, two(h, "á", "é"));
    case "causalFinal":
      return { stem: plain, suffix: "ért" };
    case "terminative":
      return { stem: plain, suffix: "ig" };
    case "inessive":
      return { stem: plain, suffix: two(h, "ban", "ben") };
    case "elative":
      return { stem: plain, suffix: two(h, "ból", "ből") };
    case "illative":
      return { stem: plain, suffix: two(h, "ba", "be") };
    case "adessive":
      return { stem: plain, suffix: two(h, "nál", "nél") };
    case "ablative":
      return { stem: plain, suffix: two(h, "tól", "től") };
    case "delative":
      return { stem: plain, suffix: two(h, "ról", "ről") };
    case "sublative":
      return { stem: plain, suffix: two(h, "ra", "re") };
    case "allative": {
      if (h === "back") return { stem: plain, suffix: "hoz" };
      return { stem: plain, suffix: hasRoundedFinalVowel(base) ? "höz" : "hez" };
    }
    case "superessive": {
      const stem = pluralBase ? base : stemFor(base, flags, "superessive");
      if (stem === base && vowelFinal) return { stem: long, suffix: "n" };
      return { stem, suffix: `${threeVowel(stem, h)}n` };
    }
  }
}

/** Attach a case suffix to `base` (a lemma or a plural form). */
export function applyCase(base: string, huCase: HuCase, opts: CaseOptions = {}): string {
  const parts = applyCaseParts(base, huCase, opts);
  return parts.stem + parts.suffix;
}

/**
 * Inflect a Hungarian noun by rules alone (plural and/or case), split into
 * stem and suffix. The suffix accumulates the whole chain, so a plural
 * accusative yields `{ stem: "ház", suffix: "akat" }`.
 */
export function inflectNounParts(
  lemma: string,
  flags: StemFlags | undefined,
  plural: boolean,
  huCase: HuCase | undefined,
  backSet?: ReadonlySet<string>,
): InflectedParts {
  if (!plural) {
    if (!huCase) return { stem: lemma, suffix: "" };
    return applyCaseParts(lemma, huCase, { flags, backSet });
  }
  const p = pluralParts(lemma, flags, backSet);
  if (!huCase) return p;
  // A plural base ends in -k: no stem alternation or lengthening can apply,
  // so the case suffix simply extends the plural suffix.
  const c = applyCaseParts(p.stem + p.suffix, huCase, { pluralBase: true, backSet, flags });
  return { stem: p.stem, suffix: p.suffix + c.suffix };
}

/**
 * Inflect a Hungarian noun by rules alone: plural and/or case.
 *
 * The caller is responsible for consulting the exception lexicon and the
 * fallback oracle first — this function is the pure rule layer.
 */
export function inflectNounRules(
  lemma: string,
  flags: StemFlags | undefined,
  plural: boolean,
  huCase: HuCase | undefined,
  backSet?: ReadonlySet<string>,
): string {
  const parts = inflectNounParts(lemma, flags, plural, huCase, backSet);
  return parts.stem + parts.suffix;
}
