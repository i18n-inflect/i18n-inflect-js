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
import { indefiniteArticle } from "./article.js";
import { pluralize } from "./plural.js";

/**
 * English language pack: a/an agreement (sound-based, incl. acronyms and
 * digits) and noun pluralization.
 *
 * `import "intl-inflect/en"` registers it as a side effect.
 */

const EXISTING_ARTICLES = new Set(["a", "an", "the"]);

function inflectPhrase(
  phrase: string,
  features: GrammaticalFeatures,
  _ctx: InflectionContext,
): InflectionResult {
  const split = splitPhrase(phrase);
  if (split.words.length === 0) return { text: phrase, confidence: "high" };

  // 1. Head inflection: pluralize the last word when requested.
  if (features.number === "plural") {
    const headIdx = split.wordIndexes[split.words.length - 1] as number;
    const [core, punct] = splitTrailingPunctuation(split.parts[headIdx] as string);
    split.parts[headIdx] = pluralize(core) + punct;
  }

  // 2. Article agreement. An explicit `article:` feature may prepend or
  //    remove one; an a/an already present in the text is always re-agreed
  //    against the word that follows it (post-interpolation).
  const firstIdx = split.wordIndexes[0] as number;
  const firstWord = split.parts[firstIdx] as string;
  const firstLower = firstWord.toLowerCase();
  const hasArticle = EXISTING_ARTICLES.has(firstLower);
  const plural = features.number === "plural";

  const wordAfter = (index: number): string => {
    const idx = split.wordIndexes[index];
    return idx === undefined ? "" : (split.parts[idx] as string);
  };

  if (features.article === "none" && hasArticle) {
    // Remove the article and its following whitespace.
    split.parts[firstIdx] = "";
    if (split.wordIndexes.length > 1) split.parts[firstIdx + 1] = "";
  } else if (hasArticle) {
    if (firstLower !== "the") {
      const next = wordAfter(1);
      const article = plural ? "" : indefiniteArticle(next);
      if (article === "") {
        // "a card" + plural → "cards": indefinite article has no plural.
        split.parts[firstIdx] = "";
        if (split.wordIndexes.length > 1) split.parts[firstIdx + 1] = "";
      } else {
        split.parts[firstIdx] = isCapitalized(firstWord) ? capitalize(article) : article;
      }
    }
  } else if (features.article === "definite") {
    split.parts[firstIdx] = `the ${firstWord}`;
  } else if (features.article === "indefinite" && !plural) {
    split.parts[firstIdx] = `${indefiniteArticle(firstWord)} ${firstWord}`;
  }

  return { text: joinPhrase(split), confidence: "high" };
}

/** The English language pack. */
export const en: LanguagePack = {
  locale: "en",
  inflectPhrase,
};

registerLanguage(en);
