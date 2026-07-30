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
import type { StemFlags } from "../packages/i18n-inflect/src/hu/stems.js";
import { BACK_NEUTRAL_LEMMAS, harmonyOf } from "../packages/i18n-inflect/src/hu/phonology.js";
import { diffAll, rulesAccuracy } from "./diff-hu.js";
import { SEED_OVERRIDE_LINES, SEED_STEM_LINES } from "./seed-hu.js";
import {
  fnv1a,
  isDev,
  isHeldOut,
  loadRows,
  type Row,
  UNIMORPH_HUN_SHA,
  UNIMORPH_HUN_URL,
} from "./unimorph.js";

const ROOT = new URL("..", import.meta.url).pathname;
const RAW = `${ROOT}data/raw/hun.tsv`;
const GEN = `${ROOT}packages/i18n-inflect/src/hu/exceptions.gen.ts`;
const FIXTURES_DIR = `${ROOT}packages/i18n-inflect/test/fixtures`;
const TRAINING_DIR = `${ROOT}data/training`;

/** Gates (fail the run when unmet). */
const GATE_TRAIN_WITH_LEXICON = 0.97;
const GATE_HELDOUT_RULES_ONLY = 0.85;
const GATE_GZIP_BYTES = 25 * 1024;
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

function main(): void {
  download();
  const rows = loadRows(RAW);
  const train: Row[] = [];
  const heldOut: Row[] = [];
  for (const row of rows) (isHeldOut(row.lemma) ? heldOut : train).push(row);
  console.log(`rows: ${rows.length} (train ${train.length}, held-out ${heldOut.length})`);

  // 1. Diff the training split.
  const results = diffAll(train);
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
      if (r.flags.shortening) parts.push(`s:${r.flags.shortening}`);
      if (r.flags.vStem) parts.push(`v:${r.flags.vStem}`);
      if (r.flags.fleeting) parts.push(`f:${r.flags.fleeting}`);
      if (r.flags.harmony) parts.push(`h:${r.flags.harmony === "back" ? "b" : "f"}`);
      stemLines.push(`${r.lemma}|${parts.join(",")}`);
    }
    for (const [tag, form] of r.overrides) overrideOut.push(`${r.lemma}|${tag}|${form}`);
  }
  const harmonyHeads = usefulHarmonyHeads([...new Set(train.map((r) => r.lemma))]);
  let harmonyAdded = 0;
  for (const [head, harmony] of harmonyHeads) {
    if (covered.has(head) && results.find((r) => r.lemma === head)?.flags) continue;
    stemLines.push(`${head}|h:${harmony === "back" ? "b" : "f"}`);
    lexicon.set(head, { harmony });
    harmonyAdded++;
  }
  console.log(`compound-head harmony entries: ${harmonyAdded}`);

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
  const ho = rulesAccuracy(heldOut, lexicon);
  console.log(`held-out accuracy (+ compound heads):  ${pct(ho.correct / ho.total)}`);

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
${PARSER_SOURCE}`;
  writeFileSync(GEN, generated);
  const gz = gzipSync(generated).length;
  console.log(
    `exceptions.gen.ts: ${stemLines.length} flag lines, ${overrideOut.length} overrides, ` +
      `${classLines.length}+${hyphenLemmaLines.length} hyphen lines, ${(gz / 1024).toFixed(1)} kB gzipped`,
  );

  // 6. Golden fixtures from the held-out split (deterministic sample).
  mkdirSync(FIXTURES_DIR, { recursive: true });
  const sample = [...heldOut]
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
    for (const flag of spec.split(",")) {
      if (flag === "l") entry.lowering = "both";
      else if (flag === "la") entry.lowering = "accusative";
      else if (flag === "lp") entry.lowering = "plural";
      else if (flag === "k") entry.vowelPlural = "linking";
      else if (flag === "b") back.add(lemma);
      else if (flag === "h:b") entry.harmony = "back";
      else if (flag === "h:f") entry.harmony = "front";
      else if (flag.startsWith("s:")) entry.shortening = flag.slice(2);
      else if (flag.startsWith("v:")) entry.vStem = flag.slice(2);
      else if (flag.startsWith("f:")) entry.fleeting = flag.slice(2);
    }
    if (Object.keys(entry).length > 0) flags.set(lemma, entry);
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
`;

main();
