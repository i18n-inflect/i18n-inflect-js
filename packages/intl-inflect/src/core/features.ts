/**
 * The grammatical feature model.
 *
 * A small, closed vocabulary shared by every language pack, modeled after
 * Apple Foundation's `Morphology`. Languages consume the features they
 * understand and ignore the rest (with a warning, so typos surface in dev).
 */

/** Part-of-speech hint for the phrase head. */
export type PartOfSpeech =
  | "noun"
  | "properNoun"
  | "adjective"
  | "determiner"
  | "numeral"
  | "pronoun"
  | "particle";

/** Grammatical number of the phrase head. */
export type GrammaticalNumber = "singular" | "plural";

/** Grammatical gender (Indo-European three-way system plus "common"). */
export type GrammaticalGender = "masculine" | "feminine" | "neuter" | "common";

/**
 * Grammatical case.
 *
 * The union covers the pan-European core, the full Hungarian oblique set and
 * the Korean particle semantics (topic/comitative are modeled as cases so a
 * single `case:` template key works across languages).
 */
export type GrammaticalCase =
  // pan-European core
  | "nominative"
  | "accusative"
  | "dative"
  | "genitive"
  | "instrumental"
  | "vocative"
  // Hungarian interior locatives: -ban/-ben, -ból/-ből, -ba/-be
  | "inessive"
  | "elative"
  | "illative"
  // Hungarian surface locatives: -on/-en/-ön, -ról/-ről, -ra/-re
  | "superessive"
  | "delative"
  | "sublative"
  // Hungarian proximal locatives: -nál/-nél, -tól/-től, -hoz/-hez/-höz
  | "adessive"
  | "ablative"
  | "allative"
  // Hungarian: -vá/-vé, -ért, -ig
  | "translative"
  | "causalFinal"
  | "terminative"
  // Korean particle semantics
  | "topic"
  | "comitative";

/** Definiteness of the noun phrase (drives article agreement). */
export type Definiteness = "definite" | "indefinite" | "none";

/** Grammatical person. */
export type GrammaticalPerson = "first" | "second" | "third";

/** Explicit request to prepend (or normalize) an article on the phrase. */
export type ArticleRequest = "definite" | "indefinite" | "none";

/**
 * A bundle of grammatical features to apply to a phrase.
 *
 * Every field is optional; a pack applies what it understands. This is the
 * programmatic mirror of the `^[...](key: value)` template annotations.
 */
export interface GrammaticalFeatures {
  /** Part of speech of the phrase head (default: noun). */
  partOfSpeech?: PartOfSpeech;
  /** Target grammatical number. */
  number?: GrammaticalNumber;
  /** Target grammatical case (or particle role for Korean). */
  case?: GrammaticalCase;
  /** Grammatical gender of the head — required for correct German articles. */
  gender?: GrammaticalGender;
  /** Definiteness used when agreeing an article already present in the text. */
  definiteness?: Definiteness;
  /** Grammatical person (reserved for future verb agreement). */
  person?: GrammaticalPerson;
  /** Request to prepend/normalize an article on the phrase. */
  article?: ArticleRequest;
}

const PART_OF_SPEECH: readonly PartOfSpeech[] = [
  "noun",
  "properNoun",
  "adjective",
  "determiner",
  "numeral",
  "pronoun",
  "particle",
];
const NUMBERS: readonly GrammaticalNumber[] = ["singular", "plural"];
const GENDERS: readonly GrammaticalGender[] = ["masculine", "feminine", "neuter", "common"];
const CASES: readonly GrammaticalCase[] = [
  "nominative",
  "accusative",
  "dative",
  "genitive",
  "instrumental",
  "vocative",
  "inessive",
  "elative",
  "illative",
  "superessive",
  "delative",
  "sublative",
  "adessive",
  "ablative",
  "allative",
  "translative",
  "causalFinal",
  "terminative",
  "topic",
  "comitative",
];
const DEFINITENESS: readonly Definiteness[] = ["definite", "indefinite", "none"];
const PERSONS: readonly GrammaticalPerson[] = ["first", "second", "third"];
const ARTICLES: readonly ArticleRequest[] = ["definite", "indefinite", "none"];

function pick<T extends string>(allowed: readonly T[], value: string): T | undefined {
  return (allowed as readonly string[]).includes(value) ? (value as T) : undefined;
}

/** Callback used to surface ignored template feature keys/values. */
export type FeatureWarning = (
  kind: "unknown-feature-key" | "unknown-feature-value",
  detail: string,
) => void;

/**
 * Default mapping from raw template annotations (`case: instrumental`) to
 * {@link GrammaticalFeatures}. Language packs may refine it via
 * `LanguagePack.normalizeFeatures` (e.g. to accept locale-specific aliases).
 *
 * Unknown keys and values are ignored and reported through `warn` — a
 * malformed annotation must never break formatting.
 */
export function normalizeFeatures(
  raw: Record<string, string>,
  warn: FeatureWarning = () => {},
): GrammaticalFeatures {
  const out: GrammaticalFeatures = {};
  for (const [rawKey, rawValue] of Object.entries(raw)) {
    const key = rawKey.trim();
    const value = rawValue.trim();
    switch (key) {
      case "case": {
        const v = pick(CASES, value);
        if (v) out.case = v;
        else warn("unknown-feature-value", `case: ${value}`);
        break;
      }
      case "number": {
        const v = pick(NUMBERS, value);
        if (v) out.number = v;
        else warn("unknown-feature-value", `number: ${value}`);
        break;
      }
      case "gender": {
        const v = pick(GENDERS, value);
        if (v) out.gender = v;
        else warn("unknown-feature-value", `gender: ${value}`);
        break;
      }
      case "definiteness": {
        const v = pick(DEFINITENESS, value);
        if (v) out.definiteness = v;
        else warn("unknown-feature-value", `definiteness: ${value}`);
        break;
      }
      case "article": {
        const v = pick(ARTICLES, value);
        if (v) out.article = v;
        else warn("unknown-feature-value", `article: ${value}`);
        break;
      }
      case "person": {
        const v = pick(PERSONS, value);
        if (v) out.person = v;
        else warn("unknown-feature-value", `person: ${value}`);
        break;
      }
      case "pos":
      case "partOfSpeech": {
        const v = pick(PART_OF_SPEECH, value);
        if (v) out.partOfSpeech = v;
        else warn("unknown-feature-value", `${key}: ${value}`);
        break;
      }
      case "inflect":
        // Apple-compat: `^[...](inflect: true)` is accepted and reserved for
        // the future automatic-agreement layer. It adds no explicit feature.
        break;
      default:
        warn("unknown-feature-key", key);
    }
  }
  return out;
}
