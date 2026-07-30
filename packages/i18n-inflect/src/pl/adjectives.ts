import type { PlCase, PlClass } from "./declension.js";
import { palatalize, yOrI } from "./phonology.js";

/**
 * Polish adjective agreement.
 *
 * An adjective agrees with its noun in gender, number and case, which is
 * twenty-odd cells — but unlike the noun it is completely regular. Every
 * adjective in the language takes the same endings; the only variation is
 * whether the stem is hard (`czerwony`) or soft (`tani`), which decides
 * between `-y-` and `-i-` throughout.
 *
 * The one place meaning intrudes is the plural: a group that includes men
 * takes a separate set of endings, and the noun's own lexicon entry is what
 * knows that.
 */

/** The gender an adjective agrees with, derived from the noun's class. */
export type PlGender = "masculine" | "feminine" | "neuter";

export function genderOfClass(plClass: PlClass): PlGender {
  if (plClass === "feminine-a" || plClass === "feminine-consonant") return "feminine";
  if (plClass === "neuter") return "neuter";
  return "masculine";
}

/** Singular endings, before the hard/soft `y`/`i` is chosen. */
const SINGULAR: Record<PlGender, Record<PlCase, string>> = {
  masculine: {
    nominative: "y",
    genitive: "ego",
    dative: "emu",
    accusative: "y",
    instrumental: "ym",
    locative: "ym",
    vocative: "y",
  },
  neuter: {
    nominative: "e",
    genitive: "ego",
    dative: "emu",
    accusative: "e",
    instrumental: "ym",
    locative: "ym",
    vocative: "e",
  },
  feminine: {
    nominative: "a",
    genitive: "ej",
    dative: "ej",
    accusative: "ą",
    instrumental: "ą",
    locative: "ej",
    vocative: "a",
  },
};

/** Plural endings for anything that is not a group of men. */
const PLURAL: Record<PlCase, string> = {
  nominative: "e",
  genitive: "ych",
  dative: "ym",
  accusative: "e",
  instrumental: "ymi",
  locative: "ych",
  vocative: "e",
};

/** Plural endings when the noun is masculine personal. */
const PLURAL_PERSONAL: Record<PlCase, string> = {
  ...PLURAL,
  nominative: "i",
  accusative: "ych",
  vocative: "i",
};

/**
 * The stem of an adjective, from whatever form the caller wrote it in.
 *
 * Callers write the phrase in the nominative singular, so this mostly
 * strips a `-y`, `-i`, `-a` or `-e`; it also accepts an already-inflected
 * form so that re-inflecting a phrase is idempotent.
 */
export function adjectiveStem(word: string): string {
  // A final `-i` after a velar is only the spelling of the velar
  // (`polski` → `polsk-`); anywhere else it is the stem's own softness and
  // has to stay (`tani` → `tani-`).
  if (word.endsWith("i") && !/[kg]i$/.test(word)) return word;
  for (const ending of [
    "ymi",
    "imi",
    "ych",
    "ich",
    "ego",
    "emu",
    "iej",
    "ej",
    "ym",
    "im",
    "ą",
    "y",
    "i",
    "a",
    "e",
  ]) {
    if (word.length > ending.length + 1 && word.endsWith(ending)) {
      return word.slice(0, -ending.length);
    }
  }
  return word;
}

/**
 * Whether the ending is spelled with `i` rather than `y`: after a velar or
 * a soft consonant Polish cannot write `y`, so `polski` declines
 * `polskiego`, `polskim`.
 */
function softly(stem: string): boolean {
  return stem.endsWith("i") || yOrI(stem) === "i";
}

/**
 * Join a stem and an ending. A soft stem turns the ending's `y` into `i`
 * and inserts an `i` before its `e` — `polski` declines `polskiego`,
 * `polskim` — and never writes the `i` twice.
 */
function join(stem: string, ending: string): string {
  if (!softly(stem)) return stem + ending;
  let adjusted = ending;
  if (adjusted.startsWith("y")) adjusted = `i${adjusted.slice(1)}`;
  else if (adjusted.startsWith("e")) adjusted = `i${adjusted}`;
  if (stem.endsWith("i") && adjusted.startsWith("i")) adjusted = adjusted.slice(1);
  return stem + adjusted;
}

/** Build the agreeing form of an adjective. */
export function agreeAdjective(
  word: string,
  gender: PlGender,
  plCase: PlCase,
  plural: boolean,
  options: { personal?: boolean; animate?: boolean } = {},
): string {
  const stem = adjectiveStem(word);

  if (plural && options.personal) {
    const ending = PLURAL_PERSONAL[plCase];
    // The masculine personal nominative palatalizes: `dobry` → `dobrzy`.
    if (ending === "i") {
      const softened = palatalize(stem, true);
      return softened + yOrI(softened);
    }
    return join(stem, ending);
  }

  let ending = plural ? PLURAL[plCase] : SINGULAR[gender][plCase];
  // A masculine animate accusative singular copies the genitive, exactly as
  // the noun does: `widzę dobrego psa`.
  if (!plural && gender === "masculine" && plCase === "accusative" && options.animate) {
    ending = SINGULAR.masculine.genitive;
  }
  return join(stem, ending);
}
