/**
 * The rules-vs-UniMorph diff for Hungarian.
 *
 * For every training lemma the rule engine predicts all supported forms.
 * Mismatching lemmas are handled in three tiers:
 *
 * 1. *Hyphenating lemmas* (abbreviations, foreign spellings: "house-t",
 *    "tv-vel") — every form is `lemma + "-" + rest`; the rest-bundle is
 *    extracted and deduplicated into shared suffix classes.
 * 2. *Explained lemmas* — a single lexicon entry (lowering / harmony
 *    override / shortening / fleeting / v-stem, and their legal combos)
 *    reproduces the whole paradigm.
 * 3. *Residual overrides* — whatever still mismatches is stored as
 *    individual full forms.
 */
import { resolveStemFlags } from "../packages/i18n-inflect/src/hu/compounds.js";
import { BACK_NEUTRAL_LEMMAS, harmonyOf } from "../packages/i18n-inflect/src/hu/phonology.js";
import { possessiveForm } from "../packages/i18n-inflect/src/hu/possessive.js";
import type { StemFlags } from "../packages/i18n-inflect/src/hu/stems.js";
import { inflectNounRules } from "../packages/i18n-inflect/src/hu/suffixes.js";
import { HU_CASE_TAGS, type HuCase } from "../packages/i18n-inflect/src/hu/tags.js";
import { groupByLemma, parseTag, type Row } from "./unimorph.js";

const TAG_TO_CASE = new Map<string, HuCase>(
  (Object.entries(HU_CASE_TAGS) as [HuCase, string][]).map(([c, t]) => [t, c]),
);

const PERSONS = { "1": "first", "2": "second", "3": "third" } as const;

/** Predict one form with a candidate lexicon entry. */
function predict(lemma: string, tag: string, flags: StemFlags | undefined): string {
  const { caseTag, plural } = parseTag(tag);
  const possessive = /^PSS([123])([SP])$/.exec(caseTag);
  if (possessive) {
    return possessiveForm(
      lemma,
      flags,
      {
        person: PERSONS[possessive[1] as "1" | "2" | "3"],
        plural: possessive[2] === "P",
      },
      plural,
      BACK_NEUTRAL_LEMMAS,
    );
  }
  const huCase = caseTag === "NOM" ? undefined : TAG_TO_CASE.get(caseTag);
  return inflectNounRules(lemma, flags, plural, huCase, BACK_NEUTRAL_LEMMAS);
}

/** A lemma's lexicon outcome after the diff. */
export interface LemmaResult {
  lemma: string;
  /** Single-entry explanation, when one suffices. */
  flags?: StemFlags;
  /** tag → suffix-after-hyphen, for hyphenating lemmas. */
  hyphenBundle?: Map<string, string>;
  /** Residual full-form overrides: tag → form. */
  overrides: Map<string, string>;
  /** Rule-correct forms (with `flags`, without overrides), for stats. */
  correct: number;
  total: number;
}

/** Detect the hyphenating pattern: every attested form is `lemma-rest`. */
function hyphenBundleOf(
  lemma: string,
  forms: Map<string, string[]>,
): Map<string, string> | undefined {
  const prefix = `${lemma}-`;
  const bundle = new Map<string, string>();
  for (const [tag, accepted] of forms) {
    const match = accepted.find((f) => f.startsWith(prefix) && f.length > prefix.length);
    if (match === undefined) return undefined;
    bundle.set(tag, match.slice(prefix.length));
  }
  return bundle.size > 0 ? bundle : undefined;
}

/** Candidate alternate stems, derived from attested accusative/plural forms. */
function altStemCandidates(lemma: string, forms: Map<string, string[]>): Set<string> {
  const candidates = new Set<string>();
  for (const tag of ["N;ACC;SG", "N;NOM;PL"]) {
    for (const form of forms.get(tag) ?? []) {
      const last = form.at(-1);
      if (last !== "t" && last !== "k") continue;
      const noSuffix = form.slice(0, -1);
      const linking = noSuffix.at(-1);
      if (linking !== undefined && "aeoö".includes(linking)) {
        const stem = noSuffix.slice(0, -1);
        if (stem.length >= 2 && stem !== lemma) candidates.add(stem);
      }
    }
  }
  return candidates;
}

/** Legal explanation candidates, simplest first. */
function* explanationCandidates(lemma: string, forms: Map<string, string[]>): Generator<StemFlags> {
  const opposite: "back" | "front" =
    harmonyOf(lemma, BACK_NEUTRAL_LEMMAS) === "back" ? "front" : "back";
  yield { possessiveJ: true };
  for (const lowering of ["both", "accusative", "plural"] as const) {
    yield { lowering };
    yield { lowering, possessiveJ: true };
    yield { lowering, harmony: opposite };
    yield { lowering, harmony: opposite, possessiveJ: true };
  }
  yield { harmony: opposite };
  yield { vowelPlural: "linking" };
  yield { vowelPlural: "linking", harmony: opposite };
  yield { vowelPlural: "linking", lowering: "accusative" };
  for (const stem of altStemCandidates(lemma, forms)) {
    for (const kind of ["shortening", "fleeting", "vStem"] as const) {
      yield { [kind]: stem };
      yield { [kind]: stem, possessiveJ: true };
      yield { [kind]: stem, lowering: "both" };
      yield { [kind]: stem, lowering: "both", possessiveJ: true };
      yield { [kind]: stem, harmony: opposite };
      yield { [kind]: stem, lowering: "both", harmony: opposite };
    }
  }
}

function score(
  lemma: string,
  forms: Map<string, string[]>,
  flags: StemFlags | undefined,
): { correct: number; wrong: string[] } {
  let correct = 0;
  const wrong: string[] = [];
  for (const [tag, accepted] of forms) {
    if (accepted.includes(predict(lemma, tag, flags))) correct++;
    else wrong.push(tag);
  }
  return { correct, wrong };
}

/** Diff one lemma: hyphen bundle, best explanation, residual overrides. */
export function diffLemma(lemma: string, forms: Map<string, string[]>): LemmaResult {
  const total = forms.size;
  const plain = score(lemma, forms, undefined);

  if (plain.wrong.length > 0) {
    const hyphen = hyphenBundleOf(lemma, forms);
    if (hyphen) {
      return { lemma, hyphenBundle: hyphen, overrides: new Map(), correct: 0, total };
    }
  }

  let best: { flags?: StemFlags; correct: number; wrong: string[] } = plain;
  if (plain.wrong.length > 0) {
    for (const flags of explanationCandidates(lemma, forms)) {
      const scored = score(lemma, forms, flags);
      if (scored.correct > best.correct) {
        best = { flags, correct: scored.correct, wrong: scored.wrong };
        if (scored.wrong.length === 0) break;
      }
    }
  }

  const overrides = new Map<string, string>();
  for (const tag of best.wrong) {
    overrides.set(tag, (forms.get(tag) as string[])[0] as string);
  }
  const result: LemmaResult = { lemma, overrides, correct: best.correct, total };
  if (best.flags) result.flags = best.flags;
  return result;
}

/** Run the diff over the whole training set. */
export function diffAll(rows: Row[]): LemmaResult[] {
  const results: LemmaResult[] = [];
  for (const [lemma, forms] of groupByLemma(rows)) {
    results.push(diffLemma(lemma, forms));
  }
  return results;
}

/**
 * Rules-only accuracy over rows (held-out evaluation).
 *
 * `lexicon` lets the caller measure with compound resolution against an
 * already-generated lexicon — held-out lemmas are absent from it, but their
 * compound heads usually are not, which is the whole point.
 */
export function rulesAccuracy(
  rows: Row[],
  lexicon?: ReadonlyMap<string, StemFlags>,
  blocked?: ReadonlySet<string>,
): { correct: number; total: number } {
  const heads = lexicon ? new Set(lexicon.keys()) : new Set<string>();
  let correct = 0;
  let total = 0;
  for (const [lemma, forms] of groupByLemma(rows)) {
    const flags = lexicon
      ? resolveStemFlags(lemma, lexicon, heads, BACK_NEUTRAL_LEMMAS, blocked)
      : undefined;
    for (const [tag, accepted] of forms) {
      total++;
      if (accepted.includes(predict(lemma, tag, flags))) correct++;
    }
  }
  return { correct, total };
}
