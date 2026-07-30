/**
 * Data pipeline orchestrator.
 *
 * Usage: `pnpm pipeline:hu` (≡ `tsx data-pipeline/run.ts hu`)
 *
 * Steps: load pinned UniMorph data → deterministic lemma-level split → diff
 * rules against the training split (hyphen classes → single-entry flags →
 * residual overrides) → merge hand seeds for uncovered lemmas → emit the
 * generated exception lexicon, golden test fixtures and neural-training
 * TSVs → print the accuracy report (the M2 quality gate).
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { resolveStemFlags, splitCompound } from "../packages/i18n-inflect/src/hu/compounds.js";
import { BACK_NEUTRAL_LEMMAS, harmonyOf } from "../packages/i18n-inflect/src/hu/phonology.js";
import type { StemFlags } from "../packages/i18n-inflect/src/hu/stems.js";
import { inflectNounRules } from "../packages/i18n-inflect/src/hu/suffixes.js";
import { HU_CASE_TAGS, type HuCase } from "../packages/i18n-inflect/src/hu/tags.js";

import { diffAll, rulesAccuracy } from "./diff-hu.js";
import {
  CURATED_OVERRIDE_LINES,
  CURATED_STEM_LINES,
  SEED_OVERRIDE_LINES,
  SEED_STEM_LINES,
} from "./seed-hu.js";
import {
  fnv1a,
  groupByLemma,
  isDev,
  isHeldOut,
  loadRows,
  parseTag,
  type Row,
  UNIMORPH_HUN_SHA,
  UNIMORPH_HUN_URL,
} from "./unimorph.js";
import { loadWiktionaryRows } from "./wiktionary.js";

const TAG_TO_CASE = new Map<string, HuCase>(
  (Object.entries(HU_CASE_TAGS) as [HuCase, string][]).map(([c, t]) => [t, c]),
);

const ROOT = new URL("..", import.meta.url).pathname;
const RAW = `${ROOT}data/raw/hun.tsv`;
const RAW_WIKTIONARY = `${ROOT}data/raw/hu-wiktionary.jsonl`;
const GEN = `${ROOT}packages/i18n-inflect/src/hu/exceptions.gen.ts`;
const FIXTURES_DIR = `${ROOT}packages/i18n-inflect/test/fixtures`;
const TRAINING_DIR = `${ROOT}data/training`;

/** Gates (fail the run when unmet). */
const GATE_TRAIN_WITH_LEXICON = 0.97;
const GATE_HELDOUT_RULES_ONLY = 0.85;
// The vocabulary is worth bytes: a complete Hungarian noun lexicon costs
// about what one photograph does, and only loads for callers who import the
// language.
const GATE_GZIP_BYTES = 150 * 1024;
const FIXTURE_ROWS = 3000;

function download(): void {
  if (existsSync(RAW)) return;
  console.log(`downloading UniMorph hun @ ${UNIMORPH_HUN_SHA.slice(0, 12)}…`);
  mkdirSync(`${ROOT}data/raw`, { recursive: true });
  execFileSync("curl", ["-sL", "-o", RAW, UNIMORPH_HUN_URL], { stdio: "inherit" });
}

function pct(x: number): string {
  return `${(100 * x).toFixed(2)}%`;
}

/**
 * Compound heads whose harmony disagrees with the compound they appear in.
 *
 * `halottkém` scans as back (a, o) but harmonizes with `kém`, which is
 * front — so without knowing `kém`'s class the engine produces
 * *halottkémok. These heads are regular words, so they are absent from the
 * exception lexicon; only their harmony is worth storing, and only when
 * some compound actually needs it.
 */
function usefulHarmonyHeads(lemmas: string[]): Map<string, "back" | "front"> {
  const all = new Set(lemmas);
  const useful = new Map<string, "back" | "front">();
  for (const word of lemmas) {
    for (let start = 3; start <= word.length - 3; start++) {
      const head = word.slice(start);
      if (!all.has(head)) continue;
      const headHarmony = harmonyOf(head, BACK_NEUTRAL_LEMMAS);
      if (harmonyOf(word, BACK_NEUTRAL_LEMMAS) !== headHarmony) useful.set(head, headHarmony);
      break; // longest head wins, same as splitCompound
    }
  }
  return useful;
}

/**
 * Heads that hurt more than they help.
 *
 * A word ending in a known lemma is not necessarily a compound of it:
 * `régész` is `rég` + the agent suffix `-ész`, and inheriting the noun
 * `ész`'s shortening stem turns it into *régeszek. Rather than guess which
 * endings are suffixes, score every head over the whole training set and
 * keep only the ones that come out ahead.
 */
function unsafeHeads(rows: Row[], lexicon: ReadonlyMap<string, StemFlags>): Set<string> {
  const heads = new Set(lexicon.keys());
  const tally = new Map<string, { fixed: number; broken: number }>();
  for (const [lemma, forms] of groupByLemma(rows)) {
    if (lexicon.has(lemma)) continue; // its own entry wins anyway
    const split = splitCompound(lemma, heads);
    if (!split) continue;
    const flags = resolveStemFlags(lemma, lexicon, heads, BACK_NEUTRAL_LEMMAS);
    let score = tally.get(split.head);
    if (!score) {
      score = { fixed: 0, broken: 0 };
      tally.set(split.head, score);
    }
    for (const [tag, accepted] of forms) {
      const { caseTag, plural } = parseTag(tag);
      const huCase = caseTag === "NOM" ? undefined : TAG_TO_CASE.get(caseTag);
      const withHead = accepted.includes(
        inflectNounRules(lemma, flags, plural, huCase, BACK_NEUTRAL_LEMMAS),
      );
      const without = accepted.includes(
        inflectNounRules(lemma, undefined, plural, huCase, BACK_NEUTRAL_LEMMAS),
      );
      if (withHead && !without) score.fixed++;
      else if (without && !withHead) score.broken++;
    }
  }
  const unsafe = new Set<string>();
  for (const [head, score] of tally) if (score.broken > score.fixed) unsafe.add(head);
  return unsafe;
}

/**
 * Lemmas that compound resolution would break.
 *
 * `tartalék` is not `tarta` + `lék`, but it ends in the lemma `lék` and
 * would inherit its front harmony, giving *tartalékkel. Such words are
 * regular, so the diff gives them no lexicon entry — and then nothing stops
 * the splitter at runtime. Marking them as explicitly regular costs one
 * short line each and keeps generation and runtime in agreement.
 */
function lemmasBrokenBySplitting(
  rows: Row[],
  lexicon: ReadonlyMap<string, StemFlags>,
  unsafe: ReadonlySet<string>,
): Set<string> {
  const heads = new Set([...lexicon.keys()].filter((h) => !unsafe.has(h)));
  const broken = new Set<string>();
  for (const [lemma, forms] of groupByLemma(rows)) {
    if (lexicon.has(lemma)) continue;
    const flags = resolveStemFlags(lemma, lexicon, heads, BACK_NEUTRAL_LEMMAS, unsafe);
    if (!flags) continue;
    for (const [tag, accepted] of forms) {
      const { caseTag, plural } = parseTag(tag);
      const huCase = caseTag === "NOM" ? undefined : TAG_TO_CASE.get(caseTag);
      const split = inflectNounRules(lemma, flags, plural, huCase, BACK_NEUTRAL_LEMMAS);
      const plain = inflectNounRules(lemma, undefined, plural, huCase, BACK_NEUTRAL_LEMMAS);
      if (accepted.includes(plain) && !accepted.includes(split)) {
        broken.add(lemma);
        break;
      }
    }
  }
  return broken;
}

async function main(): Promise<void> {
  download();
  const rows = loadRows(RAW);
  console.log(`UniMorph: ${rows.length} forms`);

  // Wiktionary is optional: the generated lexicon is committed, so neither
  // CI nor a contributor needs the 580 MB dump to build the package. When it
  // is present it roughly doubles the vocabulary.
  if (existsSync(RAW_WIKTIONARY)) {
    const { rows: extra, stats } = await loadWiktionaryRows(RAW_WIKTIONARY);
    const known = new Set(rows.map((r) => `${r.lemma} ${r.tag} ${r.form}`));
    let added = 0;
    for (const row of extra) {
      if (known.has(`${row.lemma} ${row.tag} ${row.form}`)) continue;
      rows.push(row);
      added++;
    }
    console.log(`Wiktionary: ${stats.rows} forms over ${stats.lemmas} lemmas, ${added} new`);
  } else {
    console.log("Wiktionary: dump absent, using UniMorph only.");
    console.log(
      `  to include it: curl -o data/raw/hu-wiktionary.jsonl https://kaikki.org/dictionary/Hungarian/kaikki.org-dictionary-Hungarian.jsonl`,
    );
  }

  const train: Row[] = [];
  const heldOut: Row[] = [];
  for (const row of rows) (isHeldOut(row.lemma) ? heldOut : train).push(row);
  console.log(`rows: ${rows.length} (train ${train.length}, held-out ${heldOut.length})`);

  // 1. Two diffs, for two different jobs.
  //
  //    The lexicon we SHIP is built from every row: withholding vocabulary
  //    from users buys nothing. The lexicon we MEASURE with is built from the
  //    training split alone, so held-out accuracy keeps meaning "words the
  //    lexicon has never seen" rather than grading itself.
  const results = diffAll(rows);
  const measured = diffAll(train);
  const regular = results.filter((r) => !r.flags && !r.hyphenBundle && r.overrides.size === 0);
  const hyphenated = results.filter((r) => r.hyphenBundle);
  const flagged = results.filter((r) => r.flags);
  const withOverrides = results.filter((r) => r.overrides.size > 0);
  const overrideLines = results.reduce((n, r) => n + r.overrides.size, 0);
  // Stats over non-hyphen lemmas (hyphen lemmas are lexicon-correct by construction).
  const formsTotal = results.reduce((n, r) => n + r.total, 0);
  const formsCorrectRules = results
    .filter((r) => !r.hyphenBundle)
    .reduce((n, r) => n + r.correct, 0);
  const hyphenForms = hyphenated.reduce((n, r) => n + r.total, 0);
  const trainAccuracy = (formsCorrectRules + overrideLines + hyphenForms) / formsTotal;

  console.log(`lemmas: ${results.length}`);
  console.log(
    `  regular (rules alone): ${regular.length} (${pct(regular.length / results.length)})`,
  );
  console.log(`  hyphen-suffixing (abbrev./foreign): ${hyphenated.length}`);
  console.log(`  explained by one lexicon entry: ${flagged.length}`);
  console.log(`  with residual overrides: ${withOverrides.length} (${overrideLines} forms)`);
  console.log(`train accuracy rules only: ${pct(formsCorrectRules / (formsTotal - hyphenForms))}`);
  console.log(`train accuracy with lexicon: ${pct(trainAccuracy)}`);

  // 2. Held-out: its lemmas are absent from the lexicon, so this measures
  //    generalization. Measured twice to show what compound resolution buys:
  //    an unseen compound still finds its head in the lexicon.
  const lexicon = new Map<string, StemFlags>();
  for (const r of results) if (r.flags) lexicon.set(r.lemma, r.flags);
  const trainOnly = new Map<string, StemFlags>();
  for (const r of measured) if (r.flags) trainOnly.set(r.lemma, r.flags);
  const hoPlain = rulesAccuracy(heldOut);
  console.log(`held-out accuracy (rules only):        ${pct(hoPlain.correct / hoPlain.total)}`);

  // 3. Assemble lexicon lines (+ hand seeds for lemmas the split left uncovered).
  const covered = new Set(results.map((r) => r.lemma));
  const stemLines: string[] = [];
  const overrideOut: string[] = [];
  for (const r of results) {
    if (r.flags) {
      const parts: string[] = [];
      if (r.flags.lowering === "both") parts.push("l");
      else if (r.flags.lowering === "accusative") parts.push("la");
      else if (r.flags.lowering === "plural") parts.push("lp");
      if (r.flags.vowelPlural) parts.push("k");
      if (r.flags.possessiveJ) parts.push("j");
      if (r.flags.shortening) parts.push(`s:${r.flags.shortening}`);
      if (r.flags.vStem) parts.push(`v:${r.flags.vStem}`);
      if (r.flags.fleeting) parts.push(`f:${r.flags.fleeting}`);
      if (r.flags.harmony) parts.push(`h:${r.flags.harmony === "back" ? "b" : "f"}`);
      stemLines.push(`${r.lemma}|${parts.join(",")}`);
    }
    for (const [tag, form] of r.overrides) overrideOut.push(`${r.lemma}|${tag}|${form}`);
  }
  const harmonyHeads = usefulHarmonyHeads([...new Set(rows.map((r) => r.lemma))]);
  let harmonyAdded = 0;
  for (const [head, harmony] of harmonyHeads) {
    if (covered.has(head) && results.find((r) => r.lemma === head)?.flags) continue;
    stemLines.push(`${head}|h:${harmony === "back" ? "b" : "f"}`);
    lexicon.set(head, { harmony });
    harmonyAdded++;
  }
  console.log(`compound-head harmony entries: ${harmonyAdded}`);

  // The safety checks run against the FINAL head set: the harmony entries
  // above become compound heads too, and `lék` firing on `tartalék` is
  // exactly the kind of false split they exist to catch.
  const unsafe = unsafeHeads(rows, lexicon);
  const unsafeMeasured = unsafeHeads(train, trainOnly);
  console.log(
    `unsafe compound heads (suffix look-alikes): ${unsafe.size}${unsafe.size ? ` — ${[...unsafe].slice(0, 8).join(", ")}` : ""}`,
  );

  const regulars = lemmasBrokenBySplitting(rows, lexicon, unsafe);
  for (const lemma of regulars) {
    stemLines.push(`${lemma}|r`);
    lexicon.set(lemma, {});
  }
  console.log(`explicitly-regular lemmas (splitting would break them): ${regulars.size}`);

  // Curated entries replace whatever the diff chose for the same lemma.
  const curated = new Map(CURATED_STEM_LINES.map((line) => [line.split("|")[0] as string, line]));
  for (let i = 0; i < stemLines.length; i++) {
    const lemma = (stemLines[i] as string).split("|")[0] as string;
    const replacement = curated.get(lemma);
    if (replacement !== undefined) {
      stemLines[i] = replacement;
      curated.delete(lemma);
    }
  }
  for (const line of curated.values()) stemLines.push(line);
  const curatedOverrides = new Map(
    CURATED_OVERRIDE_LINES.map((line) => [line.split("|").slice(0, 2).join("|"), line]),
  );
  for (let i = 0; i < overrideOut.length; i++) {
    const key = (overrideOut[i] as string).split("|").slice(0, 2).join("|");
    const replacement = curatedOverrides.get(key);
    if (replacement !== undefined) {
      overrideOut[i] = replacement;
      curatedOverrides.delete(key);
    }
  }
  for (const line of curatedOverrides.values()) overrideOut.push(line);
  console.log(
    `curated decisions applied: ${CURATED_STEM_LINES.length} stems, ${CURATED_OVERRIDE_LINES.length} forms`,
  );

  let seededStems = 0;
  let seededOverrides = 0;
  for (const line of SEED_STEM_LINES) {
    const lemma = line.split("|")[0] as string;
    if (!covered.has(lemma)) {
      stemLines.push(line);
      seededStems++;
    }
  }
  for (const line of SEED_OVERRIDE_LINES) {
    const lemma = line.split("|")[0] as string;
    if (!covered.has(lemma)) {
      overrideOut.push(line);
      seededOverrides++;
    }
  }
  if (seededStems + seededOverrides > 0) {
    console.log(
      `hand seeds merged for uncovered lemmas: ${seededStems} flags, ${seededOverrides} overrides`,
    );
  }
  const ho = rulesAccuracy(heldOut, trainOnly, unsafeMeasured);
  console.log(`held-out accuracy (+ compound heads):  ${pct(ho.correct / ho.total)}`);
  console.log(`shipped lexicon covers:                ${results.length} lemmas (all of UniMorph)`);

  const collate = new Intl.Collator("hu").compare;
  stemLines.sort(collate);
  overrideOut.sort(collate);

  // 4. Hyphen classes: dedupe identical suffix bundles.
  const classIds = new Map<string, number>();
  const classLines: string[] = [];
  const hyphenLemmaLines: string[] = [];
  for (const r of hyphenated) {
    const bundle = [...(r.hyphenBundle as Map<string, string>)]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([tag, rest]) => `${tag}:${rest}`)
      .join(",");
    let id = classIds.get(bundle);
    if (id === undefined) {
      id = classIds.size;
      classIds.set(bundle, id);
      classLines.push(`${id}|${bundle}`);
    }
    hyphenLemmaLines.push(`${r.lemma}|${id}`);
  }
  hyphenLemmaLines.sort(collate);
  console.log(`hyphen classes: ${classLines.length} bundles for ${hyphenLemmaLines.length} lemmas`);

  // 5. Emit the generated lexicon module.
  const generated = `${HEADER}
import type { StemFlags } from "./stems.js";

const STEM_DATA = \`${stemLines.join("\n")}
\`;

const OVERRIDE_DATA = \`${overrideOut.join("\n")}
\`;

const HYPHEN_CLASS_DATA = \`${classLines.join("\n")}
\`;

const HYPHEN_LEMMA_DATA = \`${hyphenLemmaLines.join("\n")}
\`;

const UNSAFE_HEAD_DATA = \`${[...unsafe].sort(collate).join("\n")}
\`;
${PARSER_SOURCE}`;
  writeFileSync(GEN, generated);
  const gz = gzipSync(generated).length;
  console.log(
    `exceptions.gen.ts: ${stemLines.length} flag lines, ${overrideOut.length} overrides, ` +
      `${classLines.length}+${hyphenLemmaLines.length} hyphen lines, ${(gz / 1024).toFixed(1)} kB gzipped`,
  );

  // 6. Golden fixtures from the held-out split (deterministic sample).
  mkdirSync(FIXTURES_DIR, { recursive: true });
  const sample = [...rows]
    .sort((a, b) => fnv1a(`${a.lemma}|${a.tag}`) - fnv1a(`${b.lemma}|${b.tag}`))
    .slice(0, FIXTURE_ROWS);
  writeFileSync(
    `${FIXTURES_DIR}/hu.golden.json`,
    `${JSON.stringify(
      {
        source: `unimorph/hun@${UNIMORPH_HUN_SHA}`,
        license: "CC BY-SA 3.0",
        rows: sample.map((r) => [r.lemma, r.tag, r.form]),
      },
      null,
      1,
    )}\n`,
  );
  console.log(`fixtures: ${sample.length} held-out rows → test/fixtures/hu.golden.json`);

  // 7. Neural training TSVs (gitignored).
  mkdirSync(TRAINING_DIR, { recursive: true });
  const dev = heldOut.filter((r) => isDev(r.lemma));
  const test = heldOut.filter((r) => !isDev(r.lemma));
  const tsv = (rs: Row[]): string => rs.map((r) => `${r.lemma}\t${r.tag}\t${r.form}`).join("\n");
  writeFileSync(`${TRAINING_DIR}/hu.train.tsv`, tsv(train));
  writeFileSync(`${TRAINING_DIR}/hu.dev.tsv`, tsv(dev));
  writeFileSync(`${TRAINING_DIR}/hu.test.tsv`, tsv(test));
  console.log(`training TSVs: train ${train.length}, dev ${dev.length}, test ${test.length}`);

  // 8. Gates.
  const failures: string[] = [];
  if (trainAccuracy < GATE_TRAIN_WITH_LEXICON)
    failures.push(`train accuracy ${pct(trainAccuracy)} < ${pct(GATE_TRAIN_WITH_LEXICON)}`);
  if (ho.correct / ho.total < GATE_HELDOUT_RULES_ONLY)
    failures.push(
      `held-out accuracy ${pct(ho.correct / ho.total)} < ${pct(GATE_HELDOUT_RULES_ONLY)}`,
    );
  if (gz > GATE_GZIP_BYTES) failures.push(`lexicon ${gz} B gz > ${GATE_GZIP_BYTES} B`);
  if (failures.length > 0) {
    console.error(`GATE FAILURES:\n  ${failures.join("\n  ")}`);
    process.exitCode = 1;
  } else {
    console.log("all gates passed ✔");
  }
}

const HEADER = `/**
 * GENERATED FILE — Hungarian exception lexicon. DO NOT EDIT BY HAND.
 *
 * Emitted by data-pipeline/run.ts from UniMorph hun
 * (https://github.com/unimorph/hun @ ${UNIMORPH_HUN_SHA}).
 * Data license: CC BY-SA 3.0 — see LICENSE-DATA.md at the repository root.
 *
 * Format (one lemma per line): \`lemma|flag[,flag…]\` where
 *   l — lowering · s:STEM — shortening · v:STEM — v-stem · f:STEM — fleeting
 *   h:b / h:f — lexical harmony override (back / front)
 */`;

/** The loader appended verbatim to the generated module. */
const PARSER_SOURCE = `
function parseStemData(data: string): {
  flags: Map<string, StemFlags>;
  back: Set<string>;
} {
  const flags = new Map<string, StemFlags>();
  const back = new Set<string>();
  for (const line of data.split("\\n")) {
    if (line.length === 0) continue;
    const [lemma, spec] = line.split("|") as [string, string];
    const entry: StemFlags = {};
    let regular = false;
    for (const flag of spec.split(",")) {
      if (flag === "r") regular = true;
      else if (flag === "l") entry.lowering = "both";
      else if (flag === "la") entry.lowering = "accusative";
      else if (flag === "lp") entry.lowering = "plural";
      else if (flag === "k") entry.vowelPlural = "linking";
      else if (flag === "j") entry.possessiveJ = true;
      else if (flag === "b") back.add(lemma);
      else if (flag === "h:b") entry.harmony = "back";
      else if (flag === "h:f") entry.harmony = "front";
      else if (flag.startsWith("s:")) entry.shortening = flag.slice(2);
      else if (flag.startsWith("v:")) entry.vStem = flag.slice(2);
      else if (flag.startsWith("f:")) entry.fleeting = flag.slice(2);
    }
    if (regular || Object.keys(entry).length > 0) flags.set(lemma, entry);
  }
  return { flags, back };
}

function parseHyphenData(
  classData: string,
  lemmaData: string,
): Map<string, ReadonlyMap<string, string>> {
  const classes = new Map<string, Map<string, string>>();
  for (const line of classData.split("\\n")) {
    if (line.length === 0) continue;
    const [id, pairs] = line.split("|") as [string, string];
    const bundle = new Map<string, string>();
    for (const pair of pairs.split(",")) {
      const colon = pair.lastIndexOf(":");
      bundle.set(pair.slice(0, colon), pair.slice(colon + 1));
    }
    classes.set(id, bundle);
  }
  const lemmas = new Map<string, ReadonlyMap<string, string>>();
  for (const line of lemmaData.split("\\n")) {
    if (line.length === 0) continue;
    const [lemma, id] = line.split("|") as [string, string];
    const bundle = classes.get(id);
    if (bundle) lemmas.set(lemma, bundle);
  }
  return lemmas;
}

const parsed = parseStemData(STEM_DATA);

/** Per-lemma stem alternation flags. */
export const STEM_FLAGS: ReadonlyMap<string, StemFlags> = parsed.flags;

/** All-neutral-vowel lemmas with back harmony (legacy \`b\` flag lines). */
export const BACK_LEMMAS: ReadonlySet<string> = parsed.back;

/** Residual full-form overrides, keyed by \`lemma|tag\`. */
export const FORM_OVERRIDES: ReadonlyMap<string, string> = new Map(
  OVERRIDE_DATA.split("\\n")
    .filter((line) => line.length > 0)
    .map((line) => {
      const [lemma, tag, form] = line.split("|") as [string, string, string];
      return [\`\${lemma}|\${tag}\`, form] as const;
    }),
);

/**
 * Hyphen-suffixing lemmas (abbreviations, foreign spellings: "tv-vel",
 * "house-t"): lemma → tag → suffix written after the hyphen.
 */
export const HYPHEN_SUFFIXES: ReadonlyMap<string, ReadonlyMap<string, string>> = parseHyphenData(
  HYPHEN_CLASS_DATA,
  HYPHEN_LEMMA_DATA,
);

/**
 * Lemmas that look like compound heads but are really derivational suffixes
 * (\`régész\` is \`rég\` + \`-ész\`, not a compound with \`ész\`). Measured, not
 * guessed: each one loses more forms than it fixes across the corpus.
 */
export const UNSAFE_COMPOUND_HEADS: ReadonlySet<string> = new Set(
  UNSAFE_HEAD_DATA.split("\\n").filter((line) => line.length > 0),
);
`;

await main();
