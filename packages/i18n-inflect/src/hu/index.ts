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
import { resolveStemFlags } from "./compounds.js";
import { RELATIONAL_FLAGS, relationalAdjective } from "./derivation.js";
import {
  BACK_LEMMAS,
  FORM_OVERRIDES,
  HYPHEN_SUFFIXES,
  STEM_FLAGS,
  UNSAFE_COMPOUND_HEADS,
} from "./exceptions.gen.js";
import { hyphenatedForm } from "./numerals.js";
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
 * `import "i18n-inflect/hu"` registers it as a side effect.
 */

const ARTICLES = new Set(["a", "az", "egy"]);

/** Merged back-harmony exception set (built-in seed + generated). */
const backSet = new Set([...BACK_NEUTRAL_LEMMAS, ...BACK_LEMMAS]);

/**
 * Lemmas that may appear as the final member of a compound. Every lexicon
 * entry qualifies — if a word behaves irregularly on its own, compounds
 * ending in it behave the same way — except those the pipeline measured as
 * suffix look-alikes rather than real heads.
 */
const COMPOUND_HEADS: ReadonlySet<string> = new Set(
  [...STEM_FLAGS.keys()].filter((lemma) => !UNSAFE_COMPOUND_HEADS.has(lemma)),
);

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

/**
 * Look a token up in the generated lexicon: first as a full-form override,
 * then as a hyphen-suffixing lemma ("tv" → "tv-vel"). Capitalization of the
 * input is preserved.
 */
function lookupLexicon(token: string, tag: string): string | undefined {
  const lower = token.toLowerCase();
  const override = FORM_OVERRIDES.get(`${lower}|${tag}`);
  if (override !== undefined) return isCapitalized(token) ? capitalize(override) : override;
  const rest = HYPHEN_SUFFIXES.get(lower)?.get(tag);
  return rest === undefined ? undefined : `${token}-${rest}`;
}

function inflectHead(
  token: string,
  plural: boolean,
  huCase: HuCase | undefined,
  derivation: GrammaticalFeatures["derivation"],
  ctx: InflectionContext,
): HeadResult {
  let [core, punct] = splitTrailingPunctuation(token);

  // Derivation runs first and produces a different word, which then inflects
  // by its own (regular) pattern: Budapest → budapesti → budapestiek.
  if (derivation === "relational" && core.length > 0) {
    const flags = resolveStemFlags(core.toLowerCase(), STEM_FLAGS, COMPOUND_HEADS, backSet);
    core = relationalAdjective(core, flags);
    if (!plural && !huCase) return { form: core + punct, confident: true };
    const form = inflectNounRules(core, RELATIONAL_FLAGS, plural, huCase, backSet);
    return { form: form + punct, confident: true };
  }

  if (core.length === 0 || (!plural && !huCase)) return { form: token, confident: true };

  const tag = nounTag(huCase, plural);

  // Abbreviations keep their period as part of the word ("okt.-ben"), so the
  // lexicon is consulted with the punctuation attached before it is treated
  // as sentence punctuation.
  const lexical = lookupLexicon(token, tag) ?? lookupLexicon(core, tag);
  if (lexical !== undefined) {
    const form = lexical.endsWith(punct) ? lexical : lexical + punct;
    return { form, confident: true };
  }

  const lower = core.toLowerCase();

  // Digits and initialisms take hyphenated suffixes derived from their
  // spoken form ("6-ot", "5-tel", "SMS-t") — see numerals.ts.
  const spelled = hyphenatedForm(core, plural, huCase);
  if (spelled !== undefined) return { form: spelled + punct, confident: true };

  // Mixed tokens the speller cannot read (e.g. "6-os", "max."): leave them
  // alone and let a fallback try. Answers are validated by acceptFallback.
  if (/^\d/.test(core) || /^[A-ZÁÉÍÓÖŐÚÜŰ]{2,}/.test(core)) {
    const request = { lemma: core, tag };
    const cached = ctx.lookup(request);
    if (cached) return { form: cached + punct, confident: true };
    ctx.requestFallback(request);
    ctx.warn("low-confidence", `cannot suffix "${core}" by rules`);
    return { form: token, confident: false };
  }

  const cached = ctx.lookup({ lemma: lower, tag });
  if (cached !== undefined) {
    return { form: (isCapitalized(core) ? capitalize(cached) : cached) + punct, confident: true };
  }

  // Rules run on the original-cased token so "Péter" → "Péterrel".
  const flags = resolveStemFlags(lower, STEM_FLAGS, COMPOUND_HEADS, backSet);
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
  const head = inflectHead(
    split.parts[headIdx] as string,
    plural,
    huCase,
    features.derivation,
    ctx,
  );
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

/** Strip diacritics so stem alternations (kéz → kezet) still match. */
function foldAccents(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

/**
 * Plausibility check for fallback answers. Hungarian suffixation keeps the
 * word's opening intact — stem alternations only ever touch vowel length or
 * a dropped vowel — so an answer that starts elsewhere is a hallucination,
 * not an inflection.
 */
function acceptFallback(request: { lemma: string }, answer: string): boolean {
  const lemma = foldAccents(request.lemma);
  const form = foldAccents(answer);
  if (form.length + 1 < lemma.length) return false;
  const prefix = Math.min(3, lemma.length);
  return form.slice(0, prefix) === lemma.slice(0, prefix);
}

/** The Hungarian language pack. */
export const hu: LanguagePack = {
  locale: "hu",
  inflectPhrase,
  acceptFallback,
};

registerLanguage(hu);
