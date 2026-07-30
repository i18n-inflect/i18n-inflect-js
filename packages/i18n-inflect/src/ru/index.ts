import type { GrammaticalCase, GrammaticalFeatures } from "../core/features.js";
import type { InflectionContext, InflectionResult, LanguagePack } from "../core/pack.js";
import { joinPhrase, splitPhrase, splitTrailingPunctuation } from "../core/phrase.js";
import { registerLanguage } from "../core/registry.js";
import { agreeAdjective, genderOfClass } from "./adjectives.js";
import { declineNoun, guessClass, type RuCase } from "./declension.js";
import { STEM_FLAGS } from "./exceptions.gen.js";

/**
 * Russian language pack: six cases in two numbers with hard and soft stems,
 * the two alphabet rules that override them, and adjective agreement in
 * gender, number and case.
 *
 * As in Polish, the one thing no spelling reveals is animacy — whether the
 * accusative copies the nominative or the genitive depends on whether the
 * noun names something alive — and that comes from the generated lexicon.
 *
 * `import "i18n-inflect/ru"` registers it as a side effect.
 */

const CASES: Partial<Record<GrammaticalCase, RuCase>> = {
  nominative: "nominative",
  genitive: "genitive",
  dative: "dative",
  accusative: "accusative",
  instrumental: "instrumental",
  comitative: "instrumental",
  // Russian has one prepositional case for both "in" and "on"; the
  // preposition the caller writes is what tells them apart.
  inessive: "prepositional",
  superessive: "prepositional",
  adessive: "prepositional",
};

/** UniMorph tags, which is how the lexicon and the fallback name a cell. */
const TAGS: Record<RuCase, string> = {
  nominative: "NOM",
  genitive: "GEN",
  dative: "DAT",
  accusative: "ACC",
  instrumental: "INS",
  prepositional: "ESS",
};

function inflectPhrase(
  phrase: string,
  features: GrammaticalFeatures,
  ctx: InflectionContext,
): InflectionResult {
  const split = splitPhrase(phrase);
  if (split.words.length === 0) return { text: phrase, confidence: "high" };

  let ruCase: RuCase = "nominative";
  if (features.case) {
    const mapped = CASES[features.case];
    if (mapped === undefined) {
      ctx.warn("unknown-feature-value", `case not supported for ru: ${features.case}`);
    } else {
      ruCase = mapped;
    }
  }
  const plural = features.number === "plural";

  // Russian puts the adjective in front, so the head is the last word.
  const headIdx = split.wordIndexes[split.words.length - 1] as number;
  const [head, punct] = splitTrailingPunctuation(split.parts[headIdx] as string);

  const lower = head.toLowerCase();
  const flags = STEM_FLAGS.get(lower);
  const ruClass = flags?.class ?? guessClass(head);

  // The lexicon holds only what the rules get wrong, so a missing word is
  // usually a word the rules handle. The exception is the accusative, which
  // needs to know whether the noun is alive — and nothing in the spelling
  // says so.
  const guessing = flags === undefined && ruCase === "accusative";

  const tag = `N;${TAGS[ruCase]};${plural ? "PL" : "SG"}`;
  const cached = ctx.lookup({ lemma: lower, tag });
  if (cached !== undefined) {
    split.parts[headIdx] = cached + punct;
  } else {
    split.parts[headIdx] = declineNoun(head, ruCase, plural, flags) + punct;
    if (guessing) {
      ctx.requestFallback({ lemma: lower, tag });
      ctx.warn("low-confidence", `animacy of "${head}" is unknown; declined as inanimate`);
    }
  }

  const gender = genderOfClass(ruClass);
  for (let w = 0; w < split.words.length - 1; w++) {
    const idx = split.wordIndexes[w] as number;
    const [word, wordPunct] = splitTrailingPunctuation(split.parts[idx] as string);
    split.parts[idx] =
      agreeAdjective(word, gender, ruCase, plural, { animate: flags?.animate === true }) +
      wordPunct;
  }

  const confidence: "high" | "low" = guessing ? "low" : "high";
  return { text: joinPhrase(split), confidence };
}

/** The Russian language pack. */
export const ru: LanguagePack = {
  locale: "ru",
  inflectPhrase,
  acceptFallback(request, answer) {
    // A case ending never shortens a word by more than a dropped vowel and
    // never lengthens it by more than `-ями`/`-ами`.
    return answer.length >= request.lemma.length - 2 && answer.length <= request.lemma.length + 4;
  },
};

registerLanguage(ru);

export { agreeAdjective } from "./adjectives.js";
export { declineNoun, guessClass } from "./declension.js";
