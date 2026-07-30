import type { GrammaticalFeatures, GrammaticalGender } from "../core/features.js";
import type { InflectionContext, InflectionResult, LanguagePack } from "../core/pack.js";
import {
  capitalize,
  isCapitalized,
  joinPhrase,
  splitPhrase,
  splitTrailingPunctuation,
} from "../core/phrase.js";
import { registerLanguage } from "../core/registry.js";
import {
  adjectiveEnding,
  adjectiveStem,
  articleForm,
  type DeCase,
  type Declension,
} from "./articles.js";
import { LEXICON } from "./gender.gen.js";
import { compoundHeadKey, decidedGender, resolveGender, resolvePlural } from "./nouns.js";

/**
 * German language pack: full article matrix (definite/indefinite × 4 cases ×
 * 3 genders + plural), adjective-ending agreement (weak/mixed/strong), noun
 * case endings (genitive -s/-es, dative-plural -n) and — from a generated
 * lexicon — gender and plural formation.
 *
 * Give the phrase in the nominative singular; `number: "plural"` builds the
 * plural itself. Pass `gender:` to override the lexicon, which is worth
 * doing for a word it cannot know: it answers for anything, and reports
 * `confidence: "low"` when the answer is only a guess from the ending.
 *
 * `import "i18n-inflect/de"` registers it as a side effect.
 */

const DEFINITE_ARTICLES = new Set(["der", "die", "das", "den", "dem", "des"]);
const INDEFINITE_ARTICLES = new Set(["ein", "eine", "einen", "einem", "einer", "eines"]);

const DE_CASES = new Set<DeCase>(["nominative", "accusative", "dative", "genitive"]);

function resolveCase(features: GrammaticalFeatures, ctx: InflectionContext): DeCase {
  const c = features.case ?? "nominative";
  if (DE_CASES.has(c as DeCase)) return c as DeCase;
  ctx.warn("unknown-feature-value", `case not supported for de: ${c}`);
  return "nominative";
}

/** Genitive singular m/n noun ending: -es after sibilants, else -s. */
function genitiveNoun(noun: string): string {
  if (/(s|ß|x|z|tz)$/i.test(noun)) return `${noun}es`;
  return `${noun}s`;
}

/** Dative plural nouns take -n unless they already end in -n or -s. */
function dativePluralNoun(noun: string): string {
  return /[ns]$/i.test(noun) ? noun : `${noun}n`;
}

/**
 * Whether the lexicon really knows this noun, as opposed to guessing from
 * its shape. A guess is often right — German endings are informative — but
 * the caller deserves to be told which it got.
 */
function genderIsKnown(noun: string): boolean {
  return (
    LEXICON.genders.has(noun.toLowerCase()) ||
    decidedGender(noun) !== undefined ||
    compoundHeadKey(noun, LEXICON.genders, LEXICON.blockedHeads) !== undefined
  );
}

function inflectPhrase(
  phrase: string,
  features: GrammaticalFeatures,
  ctx: InflectionContext,
): InflectionResult {
  const split = splitPhrase(phrase);
  if (split.words.length === 0) return { text: phrase, confidence: "high" };

  const deCase = resolveCase(features, ctx);
  const plural = features.number === "plural";

  // The head noun is the last word; its gender governs the whole phrase.
  const headIdx = split.wordIndexes[split.words.length - 1] as number;
  const [headCore, headPunct] = splitTrailingPunctuation(split.parts[headIdx] as string);

  let confidence: "high" | "low" = "high";
  const gender: GrammaticalGender = features.gender ?? resolveGender(headCore, LEXICON);
  if (!features.gender && !genderIsKnown(headCore)) {
    ctx.warn(
      "missing-gender",
      `gender guessed from the ending for "${headCore}" — pass gender: to be sure`,
    );
    confidence = "low";
  }

  // Identify the pieces: [article?] [adjectives…] head.
  const firstIdx = split.wordIndexes[0] as number;
  const firstWord = split.parts[firstIdx] as string;
  const firstLower = firstWord.toLowerCase();
  const existingKind: "definite" | "indefinite" | undefined = DEFINITE_ARTICLES.has(firstLower)
    ? "definite"
    : INDEFINITE_ARTICLES.has(firstLower)
      ? "indefinite"
      : undefined;

  const kind: "definite" | "indefinite" | undefined =
    features.article === "definite" || features.article === "indefinite"
      ? features.article
      : features.article === "none"
        ? undefined
        : existingKind;

  // The indefinite article vanishes in the plural, so adjectives revert to
  // the strong declension ("ein rotes Auto" → "rote Autos").
  const effectiveKind = kind === "indefinite" && plural ? undefined : kind;
  const declension: Declension =
    effectiveKind === "definite" ? "weak" : effectiveKind === "indefinite" ? "mixed" : "strong";

  // Adjectives: words strictly between the article (if any) and the head.
  const adjectiveRange = {
    from: existingKind ? 1 : 0,
    to: split.words.length - 1, // exclusive
  };
  for (let w = adjectiveRange.from; w < adjectiveRange.to; w++) {
    const idx = split.wordIndexes[w] as number;
    const token = split.parts[idx] as string;
    if (isCapitalized(token)) continue; // capitalized mid-phrase word: not an adjective
    const ending = adjectiveEnding(declension, deCase, gender, plural);
    split.parts[idx] = adjectiveStem(token) + ending;
  }

  // The head noun: number first, then the case ending it takes in that
  // number — genitive m/n -s, dative plural -n.
  if (headCore.length > 0 && split.words.length > (existingKind ? 1 : 0)) {
    let head = plural ? resolvePlural(headCore, gender, LEXICON) : headCore;
    if (deCase === "genitive" && !plural && gender !== "feminine") {
      head = genitiveNoun(head);
    } else if (deCase === "dative" && plural) {
      head = dativePluralNoun(head);
    }
    split.parts[headIdx] = head + headPunct;
  }

  // Article rewrite / insertion / removal.
  if (features.article === "none" && existingKind) {
    split.parts[firstIdx] = "";
    if (split.wordIndexes.length > 1) split.parts[firstIdx + 1] = "";
  } else if (kind) {
    const form = articleForm(kind, deCase, gender, plural);
    if (existingKind) {
      if (form === undefined) {
        // Indefinite plural has no article: drop it.
        split.parts[firstIdx] = "";
        if (split.wordIndexes.length > 1) split.parts[firstIdx + 1] = "";
      } else {
        split.parts[firstIdx] = isCapitalized(firstWord) ? capitalize(form) : form;
      }
    } else if (form !== undefined) {
      // Not `firstWord`: in a one-word phrase the first word *is* the head,
      // and the head has already been pluralized and case-marked.
      split.parts[firstIdx] = `${form} ${split.parts[firstIdx]}`;
    }
  }

  return { text: joinPhrase(split), confidence };
}

/** The German language pack. */
export const de: LanguagePack = {
  locale: "de",
  inflectPhrase,
};

registerLanguage(de);
