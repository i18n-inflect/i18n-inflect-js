/**
 * Generate the Spanish and Italian gender/plural lexicons.
 *
 * Usage: `pnpm pipeline:romance`
 *
 * Only what the rules get wrong is stored. A lexicon that repeats what the
 * code already knows is dead weight, and the diff makes the rules' real
 * coverage visible: if a language needs thousands of gender entries, its
 * ending heuristic is worth improving first.
 */
import { existsSync, writeFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { pluralize as esPluralize } from "../packages/i18n-inflect/src/es/index.js";
import { pluralize as itPluralize } from "../packages/i18n-inflect/src/it/plural.js";
import { loadRomanceNouns, type RomanceNoun } from "./romance.js";

const ROOT = new URL("..", import.meta.url).pathname;

interface LanguageSpec {
  code: "es" | "it";
  name: string;
  dump: string;
  target: string;
  /** What the pack would guess with no lexicon. */
  guessGender(lemma: string): "masculine" | "feminine";
  pluralize(lemma: string, gender: "masculine" | "feminine"): string;
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
    pluralize: (lemma, gender) => itPluralize(lemma, gender),
  },
];

function emit(spec: LanguageSpec, nouns: RomanceNoun[]): void {
  const genderLines: string[] = [];
  const pluralLines: string[] = [];
  let genderRight = 0;
  let pluralRight = 0;
  let pluralKnown = 0;

  for (const noun of nouns.sort((a, b) => a.lemma.localeCompare(b.lemma))) {
    if (spec.guessGender(noun.lemma) === noun.gender) genderRight++;
    else genderLines.push(`${noun.lemma}|${noun.gender === "feminine" ? "f" : "m"}`);

    if (noun.plural === undefined) continue;
    pluralKnown++;
    if (spec.pluralize(noun.lemma, noun.gender) === noun.plural) pluralRight++;
    else pluralLines.push(`${noun.lemma}|${noun.plural}`);
  }

  const source = `/**
 * GENERATED FILE — ${spec.name} gender and plural lexicon. DO NOT EDIT BY HAND.
 *
 * Emitted by data-pipeline/run-romance.ts from the Wiktionary (wiktextract)
 * dump at kaikki.org. Data licence: CC BY-SA — see LICENSE-DATA.md.
 *
 * Only entries the rules get wrong are stored: gender where the ending
 * heuristic misleads (${genderLines.length} of ${nouns.length} nouns), and plurals the
 * spelling rules do not produce (${pluralLines.length} of ${pluralKnown}).
 */

const GENDER_DATA = \`${genderLines.join("\n")}
\`;

const PLURAL_DATA = \`${pluralLines.join("\n")}
\`;

/** Nouns whose gender contradicts what their ending suggests. */
export const GENDERS: ReadonlyMap<string, "masculine" | "feminine"> = new Map(
  GENDER_DATA.split("\\n")
    .filter((line) => line.length > 0)
    .map((line) => {
      const [lemma, gender] = line.split("|") as [string, string];
      return [lemma, gender === "f" ? "feminine" : "masculine"] as const;
    }),
);

/** Nouns whose plural the spelling rules do not produce. */
export const PLURALS: ReadonlyMap<string, string> = new Map(
  PLURAL_DATA.split("\\n")
    .filter((line) => line.length > 0)
    .map((line) => line.split("|") as [string, string]),
);
`;
  writeFileSync(spec.target, source);
  const gz = gzipSync(source).length;
  console.log(`${spec.name}: ${nouns.length} nouns`);
  console.log(
    `  gender: rules right ${((100 * genderRight) / nouns.length).toFixed(1)}%, ${genderLines.length} stored`,
  );
  console.log(
    `  plural: rules right ${((100 * pluralRight) / (pluralKnown || 1)).toFixed(1)}% of ${pluralKnown} attested, ${pluralLines.length} stored`,
  );
  console.log(`  → ${(gz / 1024).toFixed(1)} kB gzipped`);
}

for (const spec of SPECS) {
  if (!existsSync(spec.dump)) {
    console.log(`${spec.name}: dump absent at ${spec.dump} — skipping`);
    continue;
  }
  emit(spec, await loadRomanceNouns(spec.dump, spec.code));
}
