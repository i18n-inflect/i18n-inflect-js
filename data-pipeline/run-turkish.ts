/**
 * Generate the Turkish stem lexicon.
 *
 * Turkish inflection is almost entirely phonological, so the lexicon has one
 * job: record which words voice their final `p ç t k` before a vowel.
 * `kitap` → `kitabı` but `top` → `topu`, and nothing in the spelling says
 * which — so the rule is applied productively and the corpus supplies the
 * exceptions.
 *
 * Usage: `pnpm pipeline:tr`
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { canSoften } from "../packages/i18n-inflect/src/tr/phonology.js";
import {
  inflectNoun,
  type TrCase,
  type TrStemFlags,
} from "../packages/i18n-inflect/src/tr/suffixes.js";

const ROOT = new URL("..", import.meta.url).pathname;
const RAW = `${ROOT}data/raw/tur.tsv`;
const TARGET = `${ROOT}packages/i18n-inflect/src/tr/exceptions.gen.ts`;

const TAG_TO_CASE: Record<string, TrCase> = {
  ACC: "accusative",
  DAT: "dative",
  GEN: "genitive",
  LOC: "inessive",
  ABL: "elative",
  INS: "instrumental",
};

if (!existsSync(RAW)) {
  console.error(`Turkish UniMorph not found at ${RAW}`);
  console.error(
    "  curl -Lo data/raw/tur.tsv https://raw.githubusercontent.com/unimorph/tur/master/tur",
  );
  process.exit(1);
}

/** lemma → tag → attested forms. */
const corpus = new Map<string, Map<string, Set<string>>>();
for (const line of readFileSync(RAW, "utf8").split("\n")) {
  const cols = line.split("\t");
  if (cols.length !== 3) continue;
  const [lemma, form, tag] = cols as [string, string, string];
  const parts = tag.split(";");
  if (parts[0] !== "N" || parts.length !== 3) continue;
  if (!(parts[1] in TAG_TO_CASE) && parts[1] !== "NOM") continue;
  if (lemma.includes(" ") || form.includes(" ")) continue;
  let tags = corpus.get(lemma.normalize("NFC"));
  if (!tags) {
    tags = new Map();
    corpus.set(lemma.normalize("NFC"), tags);
  }
  const set = tags.get(tag);
  if (set) set.add(form.normalize("NFC"));
  else tags.set(tag, new Set([form.normalize("NFC")]));
}

function score(lemma: string, tags: Map<string, Set<string>>, flags: TrStemFlags | undefined) {
  let correct = 0;
  let total = 0;
  for (const [tag, accepted] of tags) {
    const parts = tag.split(";") as [string, string, string];
    const trCase = TAG_TO_CASE[parts[1]];
    if (parts[1] !== "NOM" && trCase === undefined) continue;
    total++;
    if (accepted.has(inflectNoun(lemma, parts[2] === "PL", trCase, flags))) correct++;
  }
  return { correct, total };
}

const lines: string[] = [];
let perfect = 0;
let fixedByFlag = 0;
let residual = 0;
let forms = 0;
let right = 0;

for (const [lemma, tags] of [...corpus].sort(([a], [b]) => a.localeCompare(b, "tr"))) {
  const plain = score(lemma, tags, undefined);
  forms += plain.total;
  if (plain.correct === plain.total) {
    perfect++;
    right += plain.correct;
    continue;
  }
  // The only lever is whether the word softens; try the opposite of the rule.
  const candidates: TrStemFlags[] = canSoften(lemma)
    ? [{ softens: false }, { bufferY: true }, { softens: false, bufferY: true }]
    : [{ bufferY: true }];
  let best: { flags?: TrStemFlags; correct: number } = { correct: plain.correct };
  for (const flags of candidates) {
    const scored = score(lemma, tags, flags);
    if (scored.correct > best.correct) best = { flags, correct: scored.correct };
  }
  right += best.correct;
  if (best.flags) {
    const parts: string[] = [];
    if (best.flags.softens === false) parts.push("h"); // hard: does not soften
    if (best.flags.bufferY) parts.push("y");
    lines.push(`${lemma}|${parts.join(",")}`);
    if (best.correct === plain.total) fixedByFlag++;
    else residual++;
  } else {
    residual++;
  }
}

const source = `/**
 * GENERATED FILE — Turkish stem lexicon. DO NOT EDIT BY HAND.
 *
 * Emitted by data-pipeline/run-turkish.ts from UniMorph tur
 * (https://github.com/unimorph/tur). Data licence: CC BY-SA — see
 * LICENSE-DATA.md.
 *
 * Turkish morphology is phonological almost everywhere, so this file is
 * small by design: it records only which words refuse to voice their final
 * \`p ç t k\` before a vowel (\`top\` → \`topu\`, not *tobu), plus a handful of
 * irregular buffer consonants (\`su\` → \`suyun\`).
 *
 *   h — hard: the final consonant does not soften
 *   y — takes a y buffer where n would be expected
 */
import type { TrStemFlags } from "./suffixes.js";

const STEM_DATA = \`${lines.join("\n")}
\`;

/** Words whose final consonant does not soften, and other stem oddities. */
export const STEM_FLAGS: ReadonlyMap<string, TrStemFlags> = new Map(
  STEM_DATA.split("\\n")
    .filter((line) => line.length > 0)
    .map((line) => {
      const [lemma, spec] = line.split("|") as [string, string];
      const flags: TrStemFlags = {};
      for (const flag of spec.split(",")) {
        if (flag === "h") flags.softens = false;
        else if (flag === "y") flags.bufferY = true;
      }
      return [lemma, flags] as const;
    }),
);
`;

writeFileSync(TARGET, source);
console.log(`Turkish: ${corpus.size} lemmas, ${forms} forms`);
console.log(`  rules alone right: ${((100 * right) / forms).toFixed(2)}%`);
console.log(`  perfect by rules:  ${perfect} lemmas`);
console.log(`  fixed by one flag: ${fixedByFlag}`);
console.log(`  still imperfect:   ${residual}`);
console.log(`  → ${(gzipSync(source).length / 1024).toFixed(1)} kB gzipped`);
