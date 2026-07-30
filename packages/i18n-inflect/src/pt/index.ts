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
  definiteArticle,
  indefiniteArticle,
  type PtGender,
  type PtPreposition,
  withPreposition,
} from "./articles.js";
import { GENDERS, PLURALS } from "./gender.gen.js";
import { guessGender, pluralize } from "./nouns.js";

/**
 * Portuguese language pack: articles, the obligatory preposition-article
 * contractions (`do`, `na`, `ao`, `pelas`, and the crase `à`), pluralization
 * with the `-ão`, `-l` and `-m` spelling rules, and a generated gender
 * lexicon so callers rarely have to supply gender.
 *
 * `import "i18n-inflect/pt"` registers it as a side effect.
 */

const DEFINITE = new Set(["o", "a", "os", "as"]);
const INDEFINITE = new Set(["um", "uma", "uns", "umas"]);

/**
 * Cases mapped to the preposition Portuguese uses for that role. The
 * feature name stays the same across languages; what changes is whether it
 * comes out as an ending or as a word.
 */
const CASE_PREPOSITIONS: Partial<Record<NonNullable<GrammaticalFeatures["case"]>, PtPreposition>> =
  {
    genitive: "de",
    ablative: "de",
    elative: "de",
    dative: "a",
    allative: "a",
    inessive: "em",
    superessive: "em",
    illative: "em",
    instrumental: "com",
    comitative: "com",
  };

function toPtGender(gender: GrammaticalGender): PtGender {
  return gender === "feminine" ? "feminine" : "masculine";
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

  // Portuguese puts the noun first and the adjective after it, so the head
  // is the first word of the phrase — `casa branca`, not `branca casa`.
  const firstIdx = split.wordIndexes[0] as number;
  const firstWord = split.parts[firstIdx] as string;
  const firstLower = firstWord.toLowerCase();
  const existing = DEFINITE.has(firstLower)
    ? "definite"
    : INDEFINITE.has(firstLower)
      ? "indefinite"
      : undefined;
  const headIdx = split.wordIndexes[existing ? 1 : 0];
  const [head] =
    headIdx === undefined ? [""] : splitTrailingPunctuation(split.parts[headIdx] as string);

  let gender: PtGender;
  if (features.gender) {
    gender = toPtGender(features.gender);
  } else {
    const known = GENDERS.get(head.toLowerCase());
    if (known) {
      gender = toPtGender(known);
    } else {
      gender = toPtGender(guessGender(head));
      ctx.warn("missing-gender", `guessed ${gender} for "${head}"`);
      confidence = "low";
    }
  }

  if (plural && headIdx !== undefined) {
    // Portuguese agrees the adjective with the noun, so every word after the
    // article takes the plural, not just the head.
    for (let w = existing ? 1 : 0; w < split.words.length; w++) {
      const idx = split.wordIndexes[w] as number;
      const [core, punct] = splitTrailingPunctuation(split.parts[idx] as string);
      split.parts[idx] = (PLURALS.get(core.toLowerCase()) ?? pluralize(core)) + punct;
    }
  }

  const preposition = features.case ? CASE_PREPOSITIONS[features.case] : undefined;
  if (features.case && features.case !== "nominative" && preposition === undefined) {
    ctx.warn("unknown-feature-value", `case not supported for pt: ${features.case}`);
  }

  const kind =
    features.article === "definite" || features.article === "indefinite"
      ? features.article
      : features.article === "none"
        ? undefined
        : (existing ?? (preposition ? "definite" : undefined));

  const write = (article: string): void => {
    if (existing) {
      // Replacing an article: keep whatever case the old one had.
      split.parts[firstIdx] = isCapitalized(firstWord) ? capitalize(article) : article;
    } else {
      split.parts[firstIdx] = `${article} ${split.parts[firstIdx]}`;
    }
  };

  if (features.article === "none" && existing) {
    split.parts[firstIdx] = "";
    if (split.wordIndexes.length > 1) split.parts[firstIdx + 1] = "";
  } else if (kind && preposition) {
    write(withPreposition(preposition, kind, gender, plural));
  } else if (kind === "definite") {
    write(definiteArticle(gender, plural));
  } else if (kind === "indefinite") {
    write(indefiniteArticle(gender, plural));
  } else if (preposition) {
    // A bare preposition with no article: `de casa`, `em Lisboa`.
    write(preposition);
  }

  return { text: joinPhrase(split), confidence };
}

/** The Portuguese language pack. */
export const pt: LanguagePack = {
  locale: "pt",
  inflectPhrase,
};

registerLanguage(pt);

export { guessGender, pluralize } from "./nouns.js";
