import { attachAssimilating, lengthenFinalVowel } from "./orthography.js";
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
 */

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

/**
 * Build the plural (`-k`) form of a lemma.
 */
export function pluralForm(
  lemma: string,
  flags: StemFlags | undefined,
  backSet?: ReadonlySet<string>,
): string {
  // v-stems are vowel-final lemmas with a consonant-final linking stem
  // (ló → lov-ak), so resolve the stem before the vowel-final shortcut.
  const stem = stemFor(lemma, flags, "linking");
  const h = flags?.harmony ?? harmonyOf(lemma, backSet);
  if (stem === lemma && endsInVowel(lemma)) {
    // Vowel-final lemmas with a linking-vowel plural: thai → thaiok
    // (`vowelPlural`), vietnámi → vietnámiak (`lowering: "plural"`).
    if (flags?.vowelPlural === "linking") return lemma + threeVowel(lemma, h) + "k";
    if (isLoweredFor(flags, "plural") && !/[aáeé]$/i.test(lemma)) {
      return lemma + two(h, "a", "e") + "k";
    }
    return `${lengthenFinalVowel(lemma)}k`;
  }
  return stem + linkingVowel(stem, h, isLoweredFor(flags, "plural")) + "k";
}

interface CaseOptions {
  /** Stem flags of the lemma — omit when `base` is already a plural form. */
  flags?: StemFlags | undefined;
  /** True when `base` is a plural (`-k`) form: linking vowels lower (házakat). */
  pluralBase?: boolean;
  /** Generated back-harmony lemma set (all-neutral-vowel exceptions). */
  backSet?: ReadonlySet<string> | undefined;
}

/**
 * Attach a case suffix to `base` (a lemma or a plural form).
 */
export function applyCase(base: string, huCase: HuCase, opts: CaseOptions = {}): string {
  const { flags, pluralBase = false, backSet } = opts;
  const h = flags?.harmony ?? harmonyOf(base, backSet);
  const vowelFinal = endsInVowel(base);
  const long = lengthenFinalVowel(base); // lengthened variant for vowel-final stems

  switch (huCase) {
    case "accusative": {
      const stem = pluralBase ? base : stemFor(base, flags, "linking");
      if (stem === base && vowelFinal) return `${long}t`;
      const lowered = pluralBase || isLoweredFor(flags, "accusative");
      const final = finalConsonantOf(stem);
      const bareT =
        !lowered && stem === base && final !== undefined && BARE_T_FINALS.has(final.grapheme);
      if (bareT) return `${base}t`;
      return stem + linkingVowel(stem, h, lowered) + "t";
    }
    case "dative":
    case "genitive":
      return (vowelFinal ? long : base) + two(h, "nak", "nek");
    case "instrumental":
      if (vowelFinal) return long + two(h, "val", "vel");
      return attachAssimilating(base, two(h, "al", "el"));
    case "translative":
      if (vowelFinal) return long + two(h, "vá", "vé");
      return attachAssimilating(base, two(h, "á", "é"));
    case "causalFinal":
      return (vowelFinal ? long : base) + "ért";
    case "terminative":
      return (vowelFinal ? long : base) + "ig";
    case "inessive":
      return (vowelFinal ? long : base) + two(h, "ban", "ben");
    case "elative":
      return (vowelFinal ? long : base) + two(h, "ból", "ből");
    case "illative":
      return (vowelFinal ? long : base) + two(h, "ba", "be");
    case "adessive":
      return (vowelFinal ? long : base) + two(h, "nál", "nél");
    case "ablative":
      return (vowelFinal ? long : base) + two(h, "tól", "től");
    case "delative":
      return (vowelFinal ? long : base) + two(h, "ról", "ről");
    case "sublative":
      return (vowelFinal ? long : base) + two(h, "ra", "re");
    case "allative": {
      const stem = vowelFinal ? long : base;
      if (h === "back") return `${stem}hoz`;
      return hasRoundedFinalVowel(base) ? `${stem}höz` : `${stem}hez`;
    }
    case "superessive": {
      const stem = pluralBase ? base : stemFor(base, flags, "superessive");
      if (stem === base && vowelFinal) return `${long}n`;
      return stem + threeVowel(stem, h) + "n";
    }
  }
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
  const base = plural ? pluralForm(lemma, flags, backSet) : lemma;
  if (!huCase) return base;
  // Flags travel into the plural chain for the harmony override; stem
  // alternations are guarded by `pluralBase` inside applyCase.
  if (plural) return applyCase(base, huCase, { pluralBase: true, backSet, flags });
  return applyCase(base, huCase, { flags, backSet });
}
