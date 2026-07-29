import type { GrammaticalFeatures } from "../core/features.js";
import type { InflectionContext, InflectionResult, LanguagePack } from "../core/pack.js";
import {
  capitalize,
  isCapitalized,
  joinPhrase,
  splitPhrase,
  splitTrailingPunctuation,
} from "../core/phrase.js";
import { registerLanguage } from "../core/registry.js";
import { definiteArticle } from "./article.js";
import { BACK_LEMMAS, FORM_OVERRIDES, HYPHEN_SUFFIXES, STEM_FLAGS } from "./exceptions.gen.js";
import { BACK_NEUTRAL_LEMMAS, vowelsOf } from "./phonology.js";
import { inflectNounRules } from "./suffixes.js";
import { type HuCase, isHuCase, nounTag } from "./tags.js";

/**
 * Hungarian language pack — the flagship module.
 *
 * Inflects the head (last word) of a noun phrase through the case/plural
 * suffix engine with full vowel harmony, stem alternations and
 * v-assimilation, and agrees the definite article (a/az) with the
 * pronunciation of the word that follows it.
 *
 * `import "intl-inflect/hu"` registers it as a side effect.
 */

const ARTICLES = new Set(["a", "az", "egy"]);

/** Merged back-harmony exception set (built-in seed + generated). */
const backSet = new Set([...BACK_NEUTRAL_LEMMAS, ...BACK_LEMMAS]);

/**
 * Heuristic uncertainty test: unknown lemmas that look foreign or whose
 * harmony cannot be decided confidently. These get `confidence: "low"` and
 * a fallback request so the neural oracle can improve them.
 */
function isSuspicious(lemma: string): boolean {
  if (STEM_FLAGS.has(lemma)) return false;
  // Foreign letters (y outside the digraphs gy/ly/ny/ty).
  if (/[qwx]|(?<![glnt])y/.test(lemma)) return true;
  const vowels = vowelsOf(lemma);
  if (vowels.length === 0) return true;
  // All-neutral-vowel words: back behavior is a closed lexical class, so an
  // unknown one is a guess (front) — flag it.
  if (vowels.every((v) => "iíé".includes(v)) && !backSet.has(lemma)) return true;
  return false;
}

interface HeadResult {
  form: string;
  confident: boolean;
}

function inflectHead(
  token: string,
  plural: boolean,
  huCase: HuCase | undefined,
  ctx: InflectionContext,
): HeadResult {
  const [core, punct] = splitTrailingPunctuation(token);
  if (core.length === 0 || (!plural && !huCase)) return { form: token, confident: true };

  const lower = core.toLowerCase();
  const tag = nounTag(huCase, plural);

  const override = FORM_OVERRIDES.get(`${lower}|${tag}`);
  if (override !== undefined) {
    return {
      form: (isCapitalized(core) ? capitalize(override) : override) + punct,
      confident: true,
    };
  }

  // Hyphen-suffixing lemmas from the lexicon: "tv" → "tv-vel", "show" → "show-t".
  const hyphen = HYPHEN_SUFFIXES.get(lower);
  if (hyphen) {
    const rest = hyphen.get(tag);
    if (rest !== undefined) return { form: `${core}-${rest}${punct}`, confident: true };
  }

  // Digits and unknown acronyms need spoken-form-based suffixes ("6-ot",
  // "SMS-t") — beyond rules in v1: leave unchanged, ask the oracle.
  if (/^\d/.test(core) || /^[A-ZÁÉÍÓÖŐÚÜŰ]{2,}$/.test(core)) {
    const request = { lemma: core, tag };
    const cached = ctx.lookup(request);
    if (cached) return { form: cached + punct, confident: true };
    ctx.requestFallback(request);
    ctx.warn("low-confidence", `cannot suffix digits/acronym "${core}" by rules`);
    return { form: token, confident: false };
  }

  const cached = ctx.lookup({ lemma: lower, tag });
  if (cached !== undefined) {
    return { form: (isCapitalized(core) ? capitalize(cached) : cached) + punct, confident: true };
  }

  // Rules run on the original-cased token so "Péter" → "Péterrel".
  const flags = STEM_FLAGS.get(lower);
  const form = inflectNounRules(core, flags, plural, huCase, backSet);
  const confident = !isSuspicious(lower);
  if (!confident) ctx.requestFallback({ lemma: lower, tag });
  return { form: form + punct, confident };
}

function inflectPhrase(
  phrase: string,
  features: GrammaticalFeatures,
  ctx: InflectionContext,
): InflectionResult {
  const split = splitPhrase(phrase);
  if (split.words.length === 0) return { text: phrase, confidence: "high" };

  // Resolve the requested case; warn about cases Hungarian has no suffix for.
  let huCase: HuCase | undefined;
  if (features.case && features.case !== "nominative") {
    if (isHuCase(features.case)) huCase = features.case;
    else ctx.warn("unknown-feature-value", `case not supported for hu: ${features.case}`);
  }
  const plural = features.number === "plural";

  // 1. Inflect the head (last word).
  const headIdx = split.wordIndexes[split.words.length - 1] as number;
  const head = inflectHead(split.parts[headIdx] as string, plural, huCase, ctx);
  split.parts[headIdx] = head.form;

  // 2. Article agreement.
  const firstIdx = split.wordIndexes[0] as number;
  const firstWord = split.parts[firstIdx] as string;
  const firstLower = firstWord.toLowerCase();
  const hasArticle = ARTICLES.has(firstLower) && split.words.length > 1;

  const wordAfterArticle = (): string => {
    const idx = split.wordIndexes[1];
    return idx === undefined ? "" : (split.parts[idx] as string);
  };

  if (features.article === "none" && hasArticle) {
    split.parts[firstIdx] = "";
    split.parts[firstIdx + 1] = "";
  } else if (features.article === "indefinite") {
    if (hasArticle) split.parts[firstIdx] = isCapitalized(firstWord) ? "Egy" : "egy";
    else split.parts[firstIdx] = `egy ${firstWord}`;
  } else if (hasArticle && firstLower !== "egy") {
    // Re-agree an existing a/az with what now follows it.
    const article = definiteArticle(wordAfterArticle());
    split.parts[firstIdx] = isCapitalized(firstWord) ? capitalize(article) : article;
  } else if (features.article === "definite" && !hasArticle) {
    const article = definiteArticle(firstWord);
    split.parts[firstIdx] = `${article} ${firstWord}`;
  } else if (features.article === "definite" && firstLower === "egy") {
    const article = definiteArticle(wordAfterArticle());
    split.parts[firstIdx] = isCapitalized(firstWord) ? capitalize(article) : article;
  }

  return { text: joinPhrase(split), confidence: head.confident ? "high" : "low" };
}

/** The Hungarian language pack. */
export const hu: LanguagePack = {
  locale: "hu",
  inflectPhrase,
};

registerLanguage(hu);
