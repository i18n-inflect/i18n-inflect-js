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
import { GENDERS, PLURALS } from "./gender.gen.js";

/**
 * Spanish language pack: el/la/los/las/un/una articles (including the
 * stressed-á rule: "el agua", "el hambre"), gender heuristics and noun
 * pluralization.
 *
 * `import "i18n-inflect/es"` registers it as a side effect.
 */

/**
 * Feminine nouns beginning with stressed /a/ that take `el`/`un` in the
 * singular ("el agua fría") but `las`/`unas` in the plural.
 */
const STRESSED_A_FEMININES = new Set([
  "agua",
  "águila",
  "ala",
  "alma",
  "alza",
  "ancla",
  "ansia",
  "arca",
  "área",
  "arma",
  "arpa",
  "asa",
  "asta",
  "aula",
  "ave",
  "haba",
  "habla",
  "hacha",
  "hada",
  "hambre",
  "haya",
]);

/** `-a` nouns that are masculine (Greek `-ma` loans and friends). */
const MASCULINE_A = new Set([
  "clima",
  "día",
  "diagrama",
  "dilema",
  "drama",
  "enigma",
  "esquema",
  "idioma",
  "mapa",
  "planeta",
  "poema",
  "problema",
  "programa",
  "sistema",
  "sofá",
  "tema",
]);

/** `-o` nouns that are feminine. */
const FEMININE_O = new Set(["foto", "mano", "moto", "radio"]);

const FEMININE_ENDINGS = /(ción|sión|dad|tad|tud|umbre|nza|ie)$/;

interface GenderGuess {
  gender: GrammaticalGender;
  guessed: boolean;
}

function resolveGender(features: GrammaticalFeatures, headNoun: string): GenderGuess {
  if (features.gender) return { gender: features.gender, guessed: false };
  const lower = headNoun.toLowerCase();
  // The generated lexicon holds exactly those nouns whose ending misleads:
  // el mapa, la mano, el problema.
  const known = GENDERS.get(lower);
  if (known) return { gender: known, guessed: false };
  if (FEMININE_O.has(lower)) return { gender: "feminine", guessed: false };
  if (MASCULINE_A.has(lower)) return { gender: "masculine", guessed: false };
  if (STRESSED_A_FEMININES.has(lower)) return { gender: "feminine", guessed: false };
  if (lower.endsWith("o")) return { gender: "masculine", guessed: true };
  if (lower.endsWith("a") || FEMININE_ENDINGS.test(lower)) {
    return { gender: "feminine", guessed: true };
  }
  return { gender: "masculine", guessed: true };
}

const ACCENT_FOLD: Record<string, string> = { á: "a", é: "e", í: "i", ó: "o", ú: "u" };

/** Pluralize a Spanish noun. */
export function pluralize(word: string): string {
  const lower = word.toLowerCase();
  const attested = PLURALS.get(lower);
  if (attested !== undefined) return attested;
  // canción → canciones, francés → franceses: accented vowel + n/s drops the accent.
  const accented = /([áéíóú])([ns])$/.exec(lower);
  if (accented) {
    const folded = ACCENT_FOLD[accented[1] as string] as string;
    return `${word.slice(0, -2)}${folded}${accented[2]}es`;
  }
  if (lower.endsWith("z")) return `${word.slice(0, -1)}ces`;
  // Multisyllabic words ending in unstressed vowel + s are invariant (lunes, crisis).
  if (/[aeiou]s$/.test(lower) && (lower.match(/[aeiouáéíóú]+/g) ?? []).length >= 2) return word;
  if (/[íú]$/.test(lower)) return `${word}es`;
  if (/[aeiouáéó]$/.test(lower)) return `${word}s`;
  return `${word}es`;
}

const DEFINITE = new Set(["el", "la", "los", "las"]);
const INDEFINITE = new Set(["un", "una", "unos", "unas"]);

function articleFor(
  kind: "definite" | "indefinite",
  gender: GrammaticalGender,
  plural: boolean,
  nextWord: string,
): string {
  const feminine = gender === "feminine";
  // Stressed-á rule applies only to the immediately following singular noun.
  const stressedA = !plural && feminine && STRESSED_A_FEMININES.has(nextWord.toLowerCase());
  if (kind === "definite") {
    if (plural) return feminine ? "las" : "los";
    return feminine && !stressedA ? "la" : "el";
  }
  if (plural) return feminine ? "unas" : "unos";
  return feminine && !stressedA ? "una" : "un";
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

  // Gender is resolved from the *singular* head, before pluralization.
  const headIdx = split.wordIndexes[split.words.length - 1] as number;
  const [singularHead] = splitTrailingPunctuation(split.parts[headIdx] as string);

  if (plural) {
    const [core, punct] = splitTrailingPunctuation(split.parts[headIdx] as string);
    split.parts[headIdx] = pluralize(core) + punct;
  }

  const firstIdx = split.wordIndexes[0] as number;
  const firstWord = split.parts[firstIdx] as string;
  const firstLower = firstWord.toLowerCase();
  const existingKind = DEFINITE.has(firstLower)
    ? "definite"
    : INDEFINITE.has(firstLower)
      ? "indefinite"
      : undefined;

  const headWord = (): string => singularHead;
  const nextWordAfterArticle = (): string => {
    const idx = split.wordIndexes[1];
    return idx === undefined ? "" : (split.parts[idx] as string);
  };

  const applyArticle = (kind: "definite" | "indefinite", replace: boolean): void => {
    const guess = resolveGender(features, headWord());
    if (guess.guessed) {
      ctx.warn("missing-gender", `guessed ${guess.gender} for "${headWord()}"`);
      confidence = "low";
    }
    const next = replace ? nextWordAfterArticle() : firstWord;
    const article = articleFor(kind, guess.gender, plural, next);
    if (replace) {
      split.parts[firstIdx] = isCapitalized(firstWord) ? capitalize(article) : article;
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

/** The Spanish language pack. */
export const es: LanguagePack = {
  locale: "es",
  inflectPhrase,
};

registerLanguage(es);
