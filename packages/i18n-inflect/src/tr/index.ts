import type { GrammaticalCase, GrammaticalFeatures } from "../core/features.js";
import type { InflectionContext, InflectionResult, LanguagePack } from "../core/pack.js";
import { joinPhrase, splitPhrase, splitTrailingPunctuation } from "../core/phrase.js";
import { registerLanguage } from "../core/registry.js";
import { STEM_FLAGS } from "./exceptions.gen.js";
import { highVowel, lowVowel } from "./phonology.js";
import { inflectNoun, type TrCase } from "./suffixes.js";

/**
 * Turkish language pack.
 *
 * Turkish marks case with suffixes and has no articles or gender, so almost
 * everything is phonology: two harmony systems choose the suffix vowel, a
 * `d` devoices after voiceless consonants, and the stem's final `p ç t k`
 * voices before a vowel. That last one is the only lexical part — `kitap`
 * softens to `kitabı` but `top` stays `topu` — and it comes from a
 * generated lexicon.
 *
 * `import "i18n-inflect/tr"` registers it as a side effect.
 */

const CASES: Partial<Record<GrammaticalCase, TrCase>> = {
  accusative: "accusative",
  dative: "dative",
  genitive: "genitive",
  inessive: "inessive",
  superessive: "inessive", // Turkish makes no on/in distinction here
  elative: "elative",
  ablative: "elative",
  instrumental: "instrumental",
  comitative: "instrumental",
};

/** Proper nouns take their suffix after an apostrophe: `İstanbul'a`. */
const PROPER = /^[A-ZÇĞİÖŞÜ]/;

function inflectPhrase(
  phrase: string,
  features: GrammaticalFeatures,
  ctx: InflectionContext,
): InflectionResult {
  const split = splitPhrase(phrase);
  if (split.words.length === 0) return { text: phrase, confidence: "high" };

  let trCase: TrCase | undefined;
  if (features.case && features.case !== "nominative") {
    trCase = CASES[features.case];
    if (trCase === undefined) {
      ctx.warn("unknown-feature-value", `case not supported for tr: ${features.case}`);
    }
  }
  const plural = features.number === "plural";
  if (!plural && trCase === undefined) return { text: phrase, confidence: "high" };

  // Turkish inflects the head, which is the last word of the phrase.
  const headIdx = split.wordIndexes[split.words.length - 1] as number;
  const [core, punct] = splitTrailingPunctuation(split.parts[headIdx] as string);
  // A multi-word compound's head carries a third-person possessive
  // (cep telefonu, otobüs durağı), which changes how case attaches.
  const looksPossessed = split.words.length > 1 && /[ıiuü]$/.test(core.toLowerCase());
  const flags =
    STEM_FLAGS.get(core.toLowerCase()) ?? (looksPossessed ? { possessed: true } : undefined);

  if (PROPER.test(core)) {
    // The apostrophe separates the name from its suffix, so the suffix is
    // whatever the rules produce minus the stem.
    const inflected = inflectNoun(core, plural, trCase, flags);
    const suffix = inflected.slice(core.length);
    // Softening does not apply across an apostrophe: Sinop'a, not Sinob'a.
    const plain = inflectNoun(core, plural, trCase, { softens: false });
    const plainSuffix = plain.slice(core.length);
    split.parts[headIdx] = `${core}'${plainSuffix || suffix}${punct}`;
    return { text: joinPhrase(split), confidence: "high" };
  }

  split.parts[headIdx] = inflectNoun(core, plural, trCase, flags) + punct;
  return { text: joinPhrase(split), confidence: "high" };
}

/** The Turkish language pack. */
export const tr: LanguagePack = {
  locale: "tr",
  inflectPhrase,
  acceptFallback(request, answer) {
    // Suffixation only ever extends the word, allowing one softened letter.
    return answer.length >= request.lemma.length && answer.length <= request.lemma.length + 8;
  },
};

registerLanguage(tr);

export { highVowel, lowVowel };
