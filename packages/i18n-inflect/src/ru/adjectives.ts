import type { RuCase, RuClass } from "./declension.js";

/**
 * Russian adjective agreement.
 *
 * Adjectives are the regular half of Russian: every one of them takes the
 * same endings, and the only question is whether the stem is hard
 * (`красивый`) or soft (`синий`). The alphabet then intervenes twice, as it
 * does for nouns — no `ы` after `г к х ж ч ш щ`, no unstressed `о` after a
 * husher — which is why `русский` is `русские` and `хороший` is `хорошего`.
 */

/** The gender an adjective agrees with, derived from the noun's class. */
export type RuGender = "masculine" | "feminine" | "neuter";

export function genderOfClass(ruClass: RuClass): RuGender {
  if (ruClass === "feminine-a" || ruClass === "feminine-soft") return "feminine";
  if (ruClass === "neuter") return "neuter";
  return "masculine";
}

/** Hard-stem endings; the soft ones are derived from these. */
const SINGULAR: Record<RuGender, Record<RuCase, string>> = {
  masculine: {
    nominative: "ый",
    genitive: "ого",
    dative: "ому",
    accusative: "ый",
    instrumental: "ым",
    prepositional: "ом",
  },
  neuter: {
    nominative: "ое",
    genitive: "ого",
    dative: "ому",
    accusative: "ое",
    instrumental: "ым",
    prepositional: "ом",
  },
  feminine: {
    nominative: "ая",
    genitive: "ой",
    dative: "ой",
    accusative: "ую",
    instrumental: "ой",
    prepositional: "ой",
  },
};

const PLURAL: Record<RuCase, string> = {
  nominative: "ые",
  genitive: "ых",
  dative: "ым",
  accusative: "ые",
  instrumental: "ыми",
  prepositional: "ых",
};

/** Hard ending → soft ending, letter for letter. */
const SOFTEN: Record<string, string> = { ы: "и", о: "е", а: "я", у: "ю" };

/** Nominative endings this can strip to find the stem. */
const NOMINATIVE_ENDINGS = [
  "ыми",
  "ими",
  "ого",
  "его",
  "ому",
  "ему",
  "ых",
  "их",
  "ая",
  "яя",
  "ое",
  "ее",
  "ые",
  "ие",
  "ую",
  "юю",
  "ый",
  "ий",
  "ой",
  "ей",
  "ым",
  "им",
  "ом",
  "ем",
];

/** The stem of an adjective, from whatever form the caller wrote it in. */
export function adjectiveStem(word: string): string {
  for (const ending of NOMINATIVE_ENDINGS) {
    if (word.length > ending.length + 1 && word.endsWith(ending)) {
      return word.slice(0, -ending.length);
    }
  }
  return word;
}

/**
 * A soft-stem adjective is one whose nominative is `-ий` for a reason other
 * than the spelling rule: `синий` is soft, `русский` only looks it.
 */
export function isSoftStem(word: string): boolean {
  const stem = adjectiveStem(word);
  return (word.endsWith("ий") || word.endsWith("ее")) && !/[гкхжчшщ]$/.test(stem);
}

function spell(stem: string, ending: string, soft: boolean): string {
  let adjusted = ending;
  if (soft) {
    const first = adjusted[0] as string;
    adjusted = (SOFTEN[first] ?? first) + adjusted.slice(1);
  } else {
    if (adjusted.startsWith("ы") && /[гкхжчшщ]$/.test(stem)) adjusted = `и${adjusted.slice(1)}`;
    if (adjusted.startsWith("о") && /[жчшщц]$/.test(stem)) adjusted = `е${adjusted.slice(1)}`;
  }
  return stem + adjusted;
}

/** Build the agreeing form of an adjective. */
export function agreeAdjective(
  word: string,
  gender: RuGender,
  ruCase: RuCase,
  plural: boolean,
  options: { animate?: boolean } = {},
): string {
  const stem = adjectiveStem(word);
  const soft = isSoftStem(word);

  let ending = plural ? PLURAL[ruCase] : SINGULAR[gender][ruCase];
  // An animate accusative copies the genitive, exactly as the noun does:
  // `вижу красивого кота`, `вижу красивых котов`.
  if (ruCase === "accusative" && options.animate && (plural || gender === "masculine")) {
    ending = plural ? PLURAL.genitive : SINGULAR[gender].genitive;
  }
  return spell(stem, ending, soft);
}
