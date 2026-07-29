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
import { elides } from "./elision.js";

/**
 * French language pack: definite/indefinite articles with elision
 * (le/la/les/l'/un/une/des), h-aspiré handling, and noun pluralization.
 *
 * `import "i18n-inflect/fr"` registers it as a side effect.
 */

/** `-al` nouns that pluralize regularly (+s) instead of `-aux`. */
const AL_REGULAR = new Set(["bal", "carnaval", "chacal", "festival", "récital", "régal"]);
/** `-ail` nouns that take `-aux` (the default for `-ail` is +s). */
const AIL_TO_AUX = new Set([
  "bail",
  "corail",
  "émail",
  "soupirail",
  "travail",
  "vantail",
  "vitrail",
]);
/** `-eu`/`-au` nouns that take +s instead of +x. */
const EU_REGULAR = new Set(["bleu", "pneu", "landau", "sarrau"]);

/** Pluralize a French noun (regular patterns + closed exception classes). */
export function pluralize(word: string): string {
  const lower = word.toLowerCase();
  if (/[sxz]$/.test(lower)) return word;
  if (AIL_TO_AUX.has(lower)) return word.slice(0, -3) + "aux";
  if (lower.endsWith("al") && !AL_REGULAR.has(lower)) return `${word.slice(0, -2)}aux`;
  if (/(eau|au|eu)$/.test(lower) && !EU_REGULAR.has(lower)) return `${word}x`;
  return `${word}s`;
}

/** Feminine noun-ending heuristic, used only when no gender is supplied. */
const FEMININE_ENDINGS = /(tion|sion|té|ance|ence|ure|elle|ette|euse|ienne|ade|aison|ie)$/;

interface GenderGuess {
  gender: GrammaticalGender;
  guessed: boolean;
}

function resolveGender(features: GrammaticalFeatures, headNoun: string): GenderGuess {
  if (features.gender) return { gender: features.gender, guessed: false };
  const lower = headNoun.toLowerCase();
  return {
    gender: FEMININE_ENDINGS.test(lower) ? "feminine" : "masculine",
    guessed: true,
  };
}

const DEFINITE = new Set(["le", "la", "les", "l'"]);
const INDEFINITE = new Set(["un", "une", "des"]);

function articleFor(
  kind: "definite" | "indefinite",
  gender: GrammaticalGender,
  plural: boolean,
  nextWord: string,
): string {
  if (kind === "indefinite") {
    return plural ? "des" : gender === "feminine" ? "une" : "un";
  }
  if (plural) return "les";
  if (elides(nextWord)) return "l'";
  return gender === "feminine" ? "la" : "le";
}

function inflectPhrase(
  phrase: string,
  features: GrammaticalFeatures,
  ctx: InflectionContext,
): InflectionResult {
  const split = splitPhrase(phrase);
  if (split.words.length === 0) return { text: phrase, confidence: "high" };

  const plural = features.number === "plural";
  let confidence: "high" | "low" = "high";

  // 1. Pluralize the head (last word).
  if (plural) {
    const headIdx = split.wordIndexes[split.words.length - 1] as number;
    const [core, punct] = splitTrailingPunctuation(split.parts[headIdx] as string);
    split.parts[headIdx] = pluralize(core) + punct;
  }

  // 2. Article agreement (existing article re-agreed, or one prepended).
  const firstIdx = split.wordIndexes[0] as number;
  const firstWord = split.parts[firstIdx] as string;
  const firstLower = firstWord.toLowerCase();
  const existingKind = DEFINITE.has(firstLower)
    ? "definite"
    : INDEFINITE.has(firstLower)
      ? "indefinite"
      : undefined;

  const headWord = (): string => {
    const idx = split.wordIndexes[split.words.length - 1];
    const [core] = splitTrailingPunctuation(idx === undefined ? "" : (split.parts[idx] as string));
    return core;
  };
  const nextWordAfterArticle = (): string => {
    const idx = split.wordIndexes[1];
    return idx === undefined ? "" : (split.parts[idx] as string);
  };

  const applyArticle = (kind: "definite" | "indefinite", replace: boolean): void => {
    const guess = resolveGender(features, headWord());
    if (guess.guessed && !plural && !(kind === "definite" && elides(nextWordAfterArticle()))) {
      ctx.warn("missing-gender", `guessed ${guess.gender} for "${headWord()}"`);
      confidence = "low";
    }
    const next = replace ? nextWordAfterArticle() : firstWord;
    const article = articleFor(kind, guess.gender, plural, next);
    if (replace) {
      const cap = isCapitalized(firstWord);
      split.parts[firstIdx] = cap ? capitalize(article) : article;
      if (article === "l'" && split.wordIndexes.length > 1) {
        split.parts[firstIdx + 1] = ""; // l' attaches directly: "l'ami"
      }
    } else if (article === "l'") {
      split.parts[firstIdx] = `l'${firstWord}`;
    } else {
      split.parts[firstIdx] = `${article} ${firstWord}`;
    }
  };

  if (features.article === "none" && existingKind) {
    split.parts[firstIdx] = "";
    if (split.wordIndexes.length > 1) split.parts[firstIdx + 1] = "";
  } else if (existingKind) {
    applyArticle(existingKind, true);
  } else if (features.article === "definite" || features.article === "indefinite") {
    applyArticle(features.article, false);
  }

  return { text: joinPhrase(split), confidence };
}

/** The French language pack. */
export const fr: LanguagePack = {
  locale: "fr",
  inflectPhrase,
};

registerLanguage(fr);
