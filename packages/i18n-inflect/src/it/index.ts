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
  articulated,
  definiteArticle,
  ELIDED,
  type ItGender,
  type ItPreposition,
  indefiniteArticle,
} from "./articles.js";
import { GENDERS, PLURALS } from "./gender.gen.js";
import { pluralize } from "./plural.js";

/**
 * Italian language pack: articles chosen by the sound that follows
 * (il/lo/l'/la/i/gli/le), articulated prepositions (del, allo, nell'),
 * pluralization with the spelling rules that keep consonant sounds, and a
 * generated gender lexicon so callers rarely have to supply gender.
 *
 * `import "i18n-inflect/it"` registers it as a side effect.
 */

const DEFINITE = new Set(["il", "lo", "la", "l'", "i", "gli", "le"]);
const INDEFINITE = new Set(["un", "uno", "una", "un'"]);

/**
 * Cases mapped to the preposition Italian uses for that role. Italian has no
 * case suffixes, so `case: "genitive"` means "di", `"dative"` means "a", and
 * so on — the same feature name produces the right surface form in a
 * language that marks the role with a word instead of an ending.
 */
const CASE_PREPOSITIONS: Partial<Record<NonNullable<GrammaticalFeatures["case"]>, ItPreposition>> =
  {
    genitive: "di",
    dative: "a",
    ablative: "da",
    inessive: "in",
    superessive: "su",
  };

/** Endings that reliably signal gender when the lexicon has nothing. */
function guessGender(noun: string): { gender: ItGender; guessed: boolean } {
  const lower = noun.toLowerCase();
  const known = GENDERS.get(lower);
  if (known) return { gender: known, guessed: false };
  if (/(zione|sione|tà|tù|trice|essa)$/.test(lower)) return { gender: "feminine", guessed: true };
  if (/(ore|ismo|mento)$/.test(lower)) return { gender: "masculine", guessed: true };
  if (lower.endsWith("a")) return { gender: "feminine", guessed: true };
  return { gender: "masculine", guessed: true };
}

function toItGender(gender: GrammaticalGender): ItGender {
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

  const headIdx = split.wordIndexes[split.words.length - 1] as number;
  const [singularHead] = splitTrailingPunctuation(split.parts[headIdx] as string);

  let gender: ItGender;
  if (features.gender) {
    gender = toItGender(features.gender);
  } else {
    const guess = guessGender(singularHead);
    gender = guess.gender;
    if (guess.guessed) {
      ctx.warn("missing-gender", `guessed ${guess.gender} for "${singularHead}"`);
      confidence = "low";
    }
  }

  if (plural) {
    const [core, punct] = splitTrailingPunctuation(split.parts[headIdx] as string);
    const attested = PLURALS.get(core.toLowerCase());
    split.parts[headIdx] = (attested ?? pluralize(core, gender)) + punct;
  }

  const firstIdx = split.wordIndexes[0] as number;
  const firstWord = split.parts[firstIdx] as string;
  const firstLower = firstWord.toLowerCase();
  const existing = DEFINITE.has(firstLower)
    ? "definite"
    : INDEFINITE.has(firstLower)
      ? "indefinite"
      : undefined;

  const nextWord = (): string => {
    const idx = split.wordIndexes[existing ? 1 : 0];
    return idx === undefined ? "" : (split.parts[idx] as string);
  };

  const preposition = features.case ? CASE_PREPOSITIONS[features.case] : undefined;
  if (features.case && features.case !== "nominative" && preposition === undefined) {
    ctx.warn("unknown-feature-value", `case not supported for it: ${features.case}`);
  }

  const kind =
    features.article === "definite" || features.article === "indefinite"
      ? features.article
      : features.article === "none"
        ? undefined
        : (existing ?? (preposition ? "definite" : undefined));

  const write = (article: string, replacing: boolean): void => {
    const cased = isCapitalized(firstWord) && !replacing ? article : article;
    if (replacing) {
      split.parts[firstIdx] = isCapitalized(firstWord) ? capitalize(cased) : cased;
      if (ELIDED.has(article) && split.wordIndexes.length > 1) split.parts[firstIdx + 1] = "";
    } else if (ELIDED.has(article)) {
      split.parts[firstIdx] = article + firstWord;
    } else {
      split.parts[firstIdx] = `${article} ${firstWord}`;
    }
  };

  if (features.article === "none" && existing) {
    split.parts[firstIdx] = "";
    if (split.wordIndexes.length > 1) split.parts[firstIdx + 1] = "";
  } else if (preposition && kind === "definite") {
    write(articulated(preposition, nextWord(), gender, plural), existing !== undefined);
  } else if (kind === "definite") {
    write(definiteArticle(nextWord(), gender, plural), existing !== undefined);
  } else if (kind === "indefinite" && !plural) {
    write(indefiniteArticle(nextWord(), gender), existing !== undefined);
  } else if (kind === "indefinite" && plural && existing) {
    // Italian has no plural indefinite article; drop it.
    split.parts[firstIdx] = "";
    if (split.wordIndexes.length > 1) split.parts[firstIdx + 1] = "";
  }

  return { text: joinPhrase(split), confidence };
}

/** The Italian language pack. */
export const it: LanguagePack = {
  locale: "it",
  inflectPhrase,
};

registerLanguage(it);
