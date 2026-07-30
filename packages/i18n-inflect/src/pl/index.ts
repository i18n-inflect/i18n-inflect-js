import type { GrammaticalCase, GrammaticalFeatures } from "../core/features.js";
import type { InflectionContext, InflectionResult, LanguagePack } from "../core/pack.js";
import { joinPhrase, splitPhrase, splitTrailingPunctuation } from "../core/phrase.js";
import { registerLanguage } from "../core/registry.js";
import { agreeAdjective, genderOfClass } from "./adjectives.js";
import { declineNoun, guessClass, type PlCase } from "./declension.js";
import { STEM_FLAGS } from "./exceptions.gen.js";

/**
 * Polish language pack: seven cases in two numbers, with the stem changes
 * the endings force — palatalization (`kot` → `kocie`), the fleeting `e`
 * (`pies` → `psa`), the `ó`/`o` alternation (`stół` → `stołu`) — plus
 * adjective agreement in gender, number and case.
 *
 * There are no articles to worry about, which is a relief, and animacy to
 * worry about instead, which is not: whether the accusative copies the
 * nominative or the genitive depends on what the noun *means*, and that
 * comes from the generated lexicon.
 *
 * `import "i18n-inflect/pl"` registers it as a side effect.
 */

const CASES: Partial<Record<GrammaticalCase, PlCase>> = {
  nominative: "nominative",
  genitive: "genitive",
  dative: "dative",
  accusative: "accusative",
  instrumental: "instrumental",
  comitative: "instrumental",
  // Polish uses the locative for both "in" and "on"; the preposition, which
  // the caller writes, is what tells them apart.
  inessive: "locative",
  superessive: "locative",
  adessive: "locative",
  vocative: "vocative",
};

/** UniMorph tags, which is how the lexicon and the fallback name a cell. */
const TAGS: Record<PlCase, string> = {
  nominative: "NOM",
  genitive: "GEN",
  dative: "DAT",
  accusative: "ACC",
  instrumental: "INS",
  locative: "ESS",
  vocative: "VOC",
};

function inflectPhrase(
  phrase: string,
  features: GrammaticalFeatures,
  ctx: InflectionContext,
): InflectionResult {
  const split = splitPhrase(phrase);
  if (split.words.length === 0) return { text: phrase, confidence: "high" };

  let plCase: PlCase = "nominative";
  if (features.case) {
    const mapped = CASES[features.case];
    if (mapped === undefined) {
      ctx.warn("unknown-feature-value", `case not supported for pl: ${features.case}`);
    } else {
      plCase = mapped;
    }
  }
  const plural = features.number === "plural";

  // Polish puts the adjective in front, so the head is the last word.
  const headIdx = split.wordIndexes[split.words.length - 1] as number;
  const [head, punct] = splitTrailingPunctuation(split.parts[headIdx] as string);

  const lower = head.toLowerCase();
  const flags = STEM_FLAGS.get(lower);
  const plClass = flags?.class ?? guessClass(head);

  // The lexicon holds only what the rules get wrong, so a word missing from
  // it is usually a word the rules handle. The exception is animacy: for a
  // masculine noun the genitive and accusative depend on whether the thing
  // is alive, which no spelling reveals. That, and only that, is worth
  // asking the fallback about.
  const guessing =
    flags === undefined &&
    plClass === "masculine" &&
    (plCase === "genitive" || plCase === "accusative");

  const tag = `N;${TAGS[plCase]};${plural ? "PL" : "SG"}`;
  const cached = ctx.lookup({ lemma: lower, tag });
  if (cached !== undefined) {
    split.parts[headIdx] = cached + punct;
  } else {
    split.parts[headIdx] = declineNoun(head, plCase, plural, flags) + punct;
    if (guessing) {
      ctx.requestFallback({ lemma: lower, tag });
      ctx.warn("low-confidence", `animacy of "${head}" is unknown; declined as inanimate`);
    }
  }

  const gender = genderOfClass(plClass);
  for (let w = 0; w < split.words.length - 1; w++) {
    const idx = split.wordIndexes[w] as number;
    const [word, wordPunct] = splitTrailingPunctuation(split.parts[idx] as string);
    split.parts[idx] =
      agreeAdjective(word, gender, plCase, plural, {
        personal: flags?.personal === true,
        animate: flags?.animate === true || flags?.personal === true,
      }) + wordPunct;
  }

  const confidence: "high" | "low" = guessing ? "low" : "high";
  return { text: joinPhrase(split), confidence };
}

/** The Polish language pack. */
export const pl: LanguagePack = {
  locale: "pl",
  inflectPhrase,
  acceptFallback(request, answer) {
    // A case ending never shortens a word by more than the fleeting vowel
    // and never lengthens it by more than `-ami`/`-ach`.
    return answer.length >= request.lemma.length - 2 && answer.length <= request.lemma.length + 5;
  },
};

registerLanguage(pl);

export { agreeAdjective } from "./adjectives.js";
export { declineNoun, guessClass } from "./declension.js";
