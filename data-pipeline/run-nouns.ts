/**
 * Generate the noun gender and plural lexicons for Spanish, Italian, German
 * and Portuguese.
 *
 * Usage: `pnpm pipeline:nouns`
 *
 * Only what the rules get wrong is stored. A lexicon that repeats what the
 * code already knows is dead weight, and the diff makes the rules' real
 * coverage visible: if a language needs thousands of gender entries, its
 * ending heuristic is worth improving first.
 *
 * Each spec imports the pack's *own* gender and plural functions, so the
 * lexicon is by construction the diff against what ships — a rule change
 * that improves coverage shrinks the file on the next run.
 */
import { existsSync, writeFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import {
  compoundHeadKey,
  type DeLexicon,
  decidedGender,
  decidedPlural,
  decodePlural,
  guessGender as deGuessGender,
  pluralize as dePluralize,
  resolveGender as deResolveGender,
  resolvePlural as deResolvePlural,
  umlaut,
} from "../packages/i18n-inflect/src/de/nouns.js";
import { pluralize as esPluralize } from "../packages/i18n-inflect/src/es/index.js";
import { pluralize as itPluralize } from "../packages/i18n-inflect/src/it/plural.js";
import {
  guessGender as ptGuessGender,
  pluralize as ptPluralize,
} from "../packages/i18n-inflect/src/pt/nouns.js";
import { loadWiktionaryNouns, type NounGender, type WiktionaryNoun } from "./wiktionary-nouns.js";

const ROOT = new URL("..", import.meta.url).pathname;

const GENDER_CODE: Record<NounGender, string> = {
  masculine: "m",
  feminine: "f",
  neuter: "n",
};

interface LanguageSpec {
  code: string;
  name: string;
  dump: string;
  target: string;
  /** German capitalizes every noun; elsewhere a capital marks a proper name. */
  allowCapitalized?: boolean;
  /** What the pack would guess with no lexicon. */
  guessGender(lemma: string): NounGender;
  pluralize(lemma: string, gender: NounGender): string;
  /**
   * Encode a plural the rules miss. The default stores the form verbatim;
   * German stores a suffix code instead, which is far smaller.
   */
  encodePlural?(lemma: string, plural: string): string;
  /**
   * Resolve using the lexicon built so far, so compounds can be answered by
   * an already-stored head instead of an entry of their own.
   */
  resolveGender?(lemma: string, lexicon: DeLexicon): NounGender;
  resolvePlural?(lemma: string, gender: NounGender, lexicon: DeLexicon): string;
}

/**
 * German plural codes: `u` marks an umlauted stem, the rest is the suffix.
 * `Buch|uer` is a tenth the size of `Buch|Bücher`, and the two encodings
 * gzip differently enough to matter across ten thousand entries.
 */
const DE_SUFFIXES = ["", "e", "er", "en", "n", "s", "se", "nen", "a", "i"];

function encodeGermanPlural(lemma: string, plural: string): string {
  for (const mutated of [false, true]) {
    const stem = mutated ? umlaut(lemma) : lemma;
    if (mutated && stem === lemma) continue;
    for (const suffix of DE_SUFFIXES) {
      if (stem + suffix === plural) return `${mutated ? "u" : ""}${suffix}`;
    }
    // A few classes drop the final -e or -en before the plural suffix:
    // Datum → Daten is handled by the rules, but Firma → Firmen is not.
    for (const cut of [1, 2]) {
      const shortened = stem.slice(0, -cut);
      for (const suffix of DE_SUFFIXES) {
        if (shortened + suffix === plural) return `${mutated ? "u" : ""}-${cut}${suffix}`;
      }
    }
  }
  return `=${plural}`;
}

const SPECS: LanguageSpec[] = [
  {
    code: "es",
    name: "Spanish",
    dump: `${ROOT}data/raw/es-wiktionary.jsonl`,
    target: `${ROOT}packages/i18n-inflect/src/es/gender.gen.ts`,
    guessGender: (lemma) => {
      if (/(ción|sión|dad|tad|tud|umbre|nza|ie)$/.test(lemma)) return "feminine";
      if (lemma.endsWith("o")) return "masculine";
      if (lemma.endsWith("a")) return "feminine";
      return "masculine";
    },
    pluralize: (lemma) => esPluralize(lemma),
  },
  {
    code: "it",
    name: "Italian",
    dump: `${ROOT}data/raw/it-wiktionary.jsonl`,
    target: `${ROOT}packages/i18n-inflect/src/it/gender.gen.ts`,
    guessGender: (lemma) => {
      if (/(zione|sione|tà|tù|trice|essa)$/.test(lemma)) return "feminine";
      if (/(ore|ismo|mento)$/.test(lemma)) return "masculine";
      if (lemma.endsWith("a")) return "feminine";
      return "masculine";
    },
    pluralize: (lemma, gender) => itPluralize(lemma, gender as "masculine" | "feminine"),
  },
  {
    code: "pt",
    name: "Portuguese",
    dump: `${ROOT}data/raw/pt-wiktionary.jsonl`,
    target: `${ROOT}packages/i18n-inflect/src/pt/gender.gen.ts`,
    guessGender: ptGuessGender,
    pluralize: ptPluralize,
  },
  {
    code: "de",
    name: "German",
    dump: `${ROOT}data/raw/de-wiktionary.jsonl`,
    target: `${ROOT}packages/i18n-inflect/src/de/gender.gen.ts`,
    allowCapitalized: true,
    guessGender: deGuessGender,
    pluralize: dePluralize,
    encodePlural: encodeGermanPlural,
    resolveGender: deResolveGender,
    resolvePlural: deResolvePlural,
  },
];

interface BuildStats {
  genderRight: number;
  genderByHead: number;
  pluralRight: number;
  pluralByHead: number;
  pluralKnown: number;
}

interface Built {
  lexicon: DeLexicon & { genders: Map<string, NounGender>; plurals: Map<string, string> };
  stats: BuildStats;
}

/**
 * Build the lexicon by walking the corpus shortest word first, so that a
 * compound always meets its head already stored, and recording only what
 * the resolution still gets wrong.
 */
function build(spec: LanguageSpec, ordered: WiktionaryNoun[], blockedHeads: Set<string>): Built {
  const genders = new Map<string, NounGender>();
  const plurals = new Map<string, string>();
  const lexicon = { genders, plurals, blockedHeads };
  const stats: BuildStats = {
    genderRight: 0,
    genderByHead: 0,
    pluralRight: 0,
    pluralByHead: 0,
    pluralKnown: 0,
  };

  for (const noun of ordered) {
    const key = noun.lemma.toLowerCase();

    const byRules = spec.guessGender(noun.lemma) === noun.gender;
    if (byRules) stats.genderRight++;
    const gender = spec.resolveGender?.(noun.lemma, lexicon) ?? spec.guessGender(noun.lemma);
    if (gender === noun.gender) {
      if (!byRules) stats.genderByHead++;
    } else {
      genders.set(key, noun.gender);
    }

    if (noun.plural === undefined) continue;
    stats.pluralKnown++;
    const byPluralRules = spec.pluralize(noun.lemma, noun.gender) === noun.plural;
    if (byPluralRules) stats.pluralRight++;
    const plural =
      spec.resolvePlural?.(noun.lemma, noun.gender, lexicon) ??
      spec.pluralize(noun.lemma, noun.gender);
    if (plural === noun.plural) {
      if (!byPluralRules) stats.pluralByHead++;
    } else {
      plurals.set(
        key,
        spec.encodePlural ? spec.encodePlural(noun.lemma, noun.plural) : noun.plural,
      );
    }
  }

  return { lexicon, stats };
}

/**
 * Find the heads that cost more than they earn.
 *
 * A word can be a perfectly good noun and still a terrible compound head:
 * `Ufer` turns every `-läufer` neuter, `Dung` every `-dung` masculine. The
 * corpus can say which, so it does — each head is scored on the compounds
 * it would answer for, and the ones that lose are blocked.
 */
function measureHeads(ordered: WiktionaryNoun[], built: Built): Set<string> {
  const score = new Map<string, { helps: number; hurts: number }>();
  const tally = (head: string, right: boolean): void => {
    const entry = score.get(head) ?? { helps: 0, hurts: 0 };
    if (right) entry.helps++;
    else entry.hurts++;
    score.set(head, entry);
  };

  const { genders, plurals, blockedHeads } = built.lexicon;
  for (const noun of ordered) {
    // Score the head on what it *would* answer, whether or not the word
    // ended up in the lexicon — the entries a bad head forced are exactly
    // the evidence against it. Words a suffix already decides never reach
    // the head lookup, so they are not evidence either way.
    if (decidedGender(noun.lemma) === undefined) {
      const head = compoundHeadKey(noun.lemma, genders, blockedHeads);
      if (head !== undefined) tally(head, genders.get(head) === noun.gender);
    }
    if (noun.plural !== undefined && decidedPlural(noun.lemma, noun.gender) === undefined) {
      const head = compoundHeadKey(noun.lemma, plurals, blockedHeads);
      const code = head === undefined ? undefined : plurals.get(head);
      if (head !== undefined && code !== undefined && !code.startsWith("=")) {
        tally(head, decodePlural(noun.lemma, code) === noun.plural);
      }
    }
  }

  const blocked = new Set<string>();
  for (const [head, { helps, hurts }] of score) {
    if (hurts > helps) blocked.add(head);
  }
  return blocked;
}

/**
 * A deterministic tenth of the corpus, held out so the lexicon can be
 * measured on words it has never seen. Everything else reports how well
 * the lexicon memorized its own input, which is not a number worth having.
 */
function heldOut(lemma: string): boolean {
  let hash = 2166136261;
  for (let i = 0; i < lemma.length; i++) {
    hash = Math.imul(hash ^ lemma.charCodeAt(i), 16777619);
  }
  return (hash >>> 0) % 10 === 0;
}

function resolve(spec: LanguageSpec, noun: WiktionaryNoun, lexicon: Built["lexicon"]) {
  const key = noun.lemma.toLowerCase();
  const gender =
    spec.resolveGender?.(noun.lemma, lexicon) ??
    lexicon.genders.get(key) ??
    spec.guessGender(noun.lemma);
  const plural =
    spec.resolvePlural?.(noun.lemma, noun.gender, lexicon) ??
    lexicon.plurals.get(key) ??
    spec.pluralize(noun.lemma, noun.gender);
  return { gender, plural };
}

/** Build from nine tenths of the corpus and score the tenth left out. */
function evaluate(
  spec: LanguageSpec,
  ordered: WiktionaryNoun[],
  blocked: boolean,
): { gender: number; plural: number; of: number } {
  const train = ordered.filter((n) => !heldOut(n.lemma));
  const test = ordered.filter((n) => heldOut(n.lemma));
  let built = build(spec, train, new Set());
  if (blocked && spec.resolveGender) {
    built = build(spec, train, measureHeads(train, built));
  }
  let gender = 0;
  let plural = 0;
  let pluralOf = 0;
  for (const noun of test) {
    const got = resolve(spec, noun, built.lexicon);
    if (got.gender === noun.gender) gender++;
    if (noun.plural !== undefined) {
      pluralOf++;
      if (got.plural === noun.plural) plural++;
    }
  }
  return {
    gender: (100 * gender) / (test.length || 1),
    plural: (100 * plural) / (pluralOf || 1),
    of: test.length,
  };
}

function emit(spec: LanguageSpec, nouns: WiktionaryNoun[]): void {
  // Shortest first, so a compound always meets its head already stored.
  const ordered = [...nouns].sort(
    (a, b) => a.lemma.length - b.lemma.length || a.lemma.localeCompare(b.lemma),
  );

  // Build once to have heads to score, measure them, then build again with
  // the bad ones blocked — the second lexicon is both smaller and righter.
  let built = build(spec, ordered, new Set());
  let blockedHeads = new Set<string>();
  if (spec.resolveGender) {
    blockedHeads = measureHeads(ordered, built);
    built = build(spec, ordered, blockedHeads);
  }
  const { genders, plurals } = built.lexicon;
  const { genderRight, genderByHead, pluralRight, pluralByHead, pluralKnown } = built.stats;

  const collate = (map: ReadonlyMap<string, string>): string =>
    [...map]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}|${v}`)
      .join("\n");

  const genderLines = collate(new Map([...genders].map(([k, g]) => [k, GENDER_CODE[g]])));
  const pluralLines = collate(plurals);

  const source = `/**
 * GENERATED FILE — ${spec.name} gender and plural lexicon. DO NOT EDIT BY HAND.
 *
 * Emitted by data-pipeline/run-nouns.ts from the Wiktionary (wiktextract)
 * dump at kaikki.org. Data licence: CC BY-SA — see LICENSE-DATA.md.
 *
 * Only entries the rules get wrong are stored: gender where the ending
 * heuristic misleads (${genders.size} of ${nouns.length} nouns), and plurals the
 * rules do not produce (${plurals.size} of ${pluralKnown} attested).${
   spec.resolveGender
     ? `
 *
 * Compounds are not stored: they are resolved from their final element,
 * which is why a lexicon of ${genders.size} entries covers ${nouns.length} nouns —
 * and every compound built on one of those heads, listed or not.`
     : ""
 }
 */
import type { GrammaticalGender } from "../core/features.js";

const GENDER_DATA = \`${genderLines}
\`;

const PLURAL_DATA = \`${pluralLines}
\`;
${
  spec.resolveGender
    ? `
const BLOCKED_DATA = \`${[...blockedHeads].sort().join(" ")}\`;
`
    : ""
}
const GENDER_NAMES: Record<string, GrammaticalGender> = {
  m: "masculine",
  f: "feminine",
  n: "neuter",
};

/** Nouns whose gender contradicts what their ending suggests. */
export const GENDERS: ReadonlyMap<string, GrammaticalGender> = new Map(
  GENDER_DATA.split("\\n")
    .filter((line) => line.length > 0)
    .map((line) => {
      const [lemma, gender] = line.split("|") as [string, string];
      return [lemma, GENDER_NAMES[gender] ?? "masculine"] as const;
    }),
);

/** Nouns whose plural the rules do not produce.${spec.encodePlural ? " Values are codes." : ""} */
export const PLURALS: ReadonlyMap<string, string> = new Map(
  PLURAL_DATA.split("\\n")
    .filter((line) => line.length > 0)
    .map((line) => line.split("|") as [string, string]),
);
${
  spec.resolveGender
    ? `
/**
 * Nouns that make bad compound heads, measured against the corpus: taking
 * them as the final element gets more compounds wrong than right.
 */
export const BLOCKED_HEADS: ReadonlySet<string> = new Set(BLOCKED_DATA.split(" "));

/** The three tables together, as the resolver wants them. */
export const LEXICON = { genders: GENDERS, plurals: PLURALS, blockedHeads: BLOCKED_HEADS };
`
    : ""
}`;
  writeFileSync(spec.target, source);
  const gz = gzipSync(source).length;
  const pct = (n: number, of: number) => ((100 * n) / (of || 1)).toFixed(1);
  console.log(`${spec.name}: ${nouns.length} nouns`);
  console.log(
    `  gender: rules ${pct(genderRight, nouns.length)}%` +
      (spec.resolveGender ? `, +heads ${pct(genderRight + genderByHead, nouns.length)}%` : "") +
      `, ${genders.size} stored`,
  );
  console.log(
    `  plural: rules ${pct(pluralRight, pluralKnown)}%` +
      (spec.resolvePlural ? `, +heads ${pct(pluralRight + pluralByHead, pluralKnown)}%` : "") +
      ` of ${pluralKnown} attested, ${plurals.size} stored`,
  );
  console.log(`  → ${(gz / 1024).toFixed(1)} kB gzipped`);
  const honest = evaluate(spec, ordered, true);
  console.log(
    `  held out (${honest.of} unseen words): gender ${honest.gender.toFixed(1)}%, plural ${honest.plural.toFixed(1)}%`,
  );
  if (spec.resolveGender) {
    const unblocked = evaluate(spec, ordered, false);
    console.log(
      `    without the head blocklist: gender ${unblocked.gender.toFixed(1)}%, plural ${unblocked.plural.toFixed(1)}%`,
    );
  }
}

for (const spec of SPECS) {
  if (!existsSync(spec.dump)) {
    console.log(`${spec.name}: dump absent at ${spec.dump} — skipping`);
    continue;
  }
  emit(
    spec,
    await loadWiktionaryNouns(spec.dump, spec.code, { allowCapitalized: spec.allowCapitalized }),
  );
}
