/**
 * Generate the Polish stem lexicon.
 *
 * Usage: `pnpm pipeline:pl`
 *
 * Polish has seven cases in two numbers, but a noun is not fourteen
 * independent facts. Three plural cells are `-om`, `-ami`, `-ach` for every
 * noun in the language, several more repeat another cell, and what is left
 * is a handful of *choices*: is the masculine genitive `-a` or `-u`, does
 * the accusative copy the genitive, how is the nominative plural formed.
 *
 * Because each choice governs its own cells and no other, they can be
 * fitted one at a time instead of searched together — the corpus says what
 * each slot must be, and only the cells no slot explains are stored whole.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import {
  declineNoun,
  guessClass,
  type PlCase,
  type PlClass,
  type PlStemFlags,
} from "../packages/i18n-inflect/src/pl/declension.js";

const ROOT = new URL("..", import.meta.url).pathname;
const RAW = `${ROOT}data/raw/pol.tsv`;
const TARGET = `${ROOT}packages/i18n-inflect/src/pl/exceptions.gen.ts`;

/** UniMorph tags the locative `ESS`, which is what `kocie` is. */
const TAG_TO_CASE: Record<string, PlCase> = {
  NOM: "nominative",
  GEN: "genitive",
  DAT: "dative",
  ACC: "accusative",
  INS: "instrumental",
  ESS: "locative",
  VOC: "vocative",
};

const CLASSES: PlClass[] = ["masculine", "feminine-a", "neuter", "feminine-consonant"];

/** What each slot is allowed to be, in the order the fitter prefers them. */
const CANDIDATES = {
  genSg: ["a", "u", "y", "i"],
  datSg: ["owi", "u", "y", "i", "e"],
  locSg: ["e", "u", "y", "i"],
  nomPl: ["y", "i", "e", "owie", "a", "ie"],
  genPl: ["ów", "y", "i", "", "e"],
} as const;

if (!existsSync(RAW)) {
  console.error(`Polish UniMorph not found at ${RAW}`);
  console.error(
    "  curl -Lo data/raw/pol.tsv https://raw.githubusercontent.com/unimorph/pol/master/pol",
  );
  process.exit(1);
}

/** cell key (`case.number`) → the attested form. */
type Paradigm = Map<string, string>;

const corpus = new Map<string, Paradigm>();
for (const line of readFileSync(RAW, "utf8").split("\n")) {
  const cols = line.split("\t");
  if (cols.length !== 3) continue;
  const [lemma, form, tag] = cols as [string, string, string];
  const parts = tag.split(";");
  if (parts[0] !== "N" || parts.length !== 3) continue;
  const plCase = TAG_TO_CASE[parts[1] as string];
  const number = parts[2] === "PL" ? "pl" : parts[2] === "SG" ? "sg" : undefined;
  if (plCase === undefined || number === undefined) continue;
  if (lemma.includes(" ") || form.includes(" ")) continue;

  const key = lemma.normalize("NFC");
  let paradigm = corpus.get(key);
  if (!paradigm) {
    paradigm = new Map();
    corpus.set(key, paradigm);
  }
  // A cell with two attested forms keeps the first; the alternative is a
  // variant, not a different answer.
  const cell = `${plCase}.${number}`;
  if (!paradigm.has(cell)) paradigm.set(cell, form.normalize("NFC"));
}

const CELLS: [PlCase, boolean][] = [];
for (const plCase of Object.values(TAG_TO_CASE)) {
  CELLS.push([plCase, false], [plCase, true]);
}

function matched(lemma: string, paradigm: Paradigm, flags: PlStemFlags): number {
  let hits = 0;
  for (const [plCase, plural] of CELLS) {
    const attested = paradigm.get(`${plCase}.${plural ? "pl" : "sg"}`);
    if (attested !== undefined && declineNoun(lemma, plCase, plural, flags) === attested) hits++;
  }
  return hits;
}

/**
 * Fit one slot: keep the value that reproduces the attested cell, or leave
 * it unset if the rules already do.
 */
function fitSlot(
  lemma: string,
  paradigm: Paradigm,
  flags: PlStemFlags,
  slot: keyof typeof CANDIDATES,
  cell: string,
): void {
  const attested = paradigm.get(cell);
  if (attested === undefined) return;
  const [plCase, number] = cell.split(".") as [PlCase, string];
  const plural = number === "pl";
  if (declineNoun(lemma, plCase, plural, flags) === attested) return;
  for (const value of CANDIDATES[slot]) {
    const trial = { ...flags, [slot]: value };
    if (declineNoun(lemma, plCase, plural, trial) === attested) {
      (flags as Record<string, unknown>)[slot] = value;
      return;
    }
  }
}

/**
 * The stem every noun shares: the dative plural is stem + `-om` with no
 * exceptions, so it says outright what the oblique stem is.
 */
function stemFromCorpus(paradigm: Paradigm): string | undefined {
  const datPl = paradigm.get("dative.pl");
  return datPl?.endsWith("om") ? datPl.slice(0, -2) : undefined;
}

function fitParadigm(lemma: string, paradigm: Paradigm): PlStemFlags {
  let best: { flags: PlStemFlags; hits: number } | undefined;

  for (const plClass of CLASSES) {
    for (const stem of [undefined, stemFromCorpus(paradigm)]) {
      const flags: PlStemFlags = {};
      if (plClass !== guessClass(lemma)) flags.class = plClass;
      if (stem !== undefined) flags.stem = stem;

      fitSlot(lemma, paradigm, flags, "genSg", "genitive.sg");
      fitSlot(lemma, paradigm, flags, "datSg", "dative.sg");
      fitSlot(lemma, paradigm, flags, "locSg", "locative.sg");
      fitSlot(lemma, paradigm, flags, "nomPl", "nominative.pl");
      fitSlot(lemma, paradigm, flags, "genPl", "genitive.pl");

      // Animacy is not a spelling fact but a syntactic one: it shows up as
      // the accusative copying the genitive.
      const accSg = paradigm.get("accusative.sg");
      if (accSg !== undefined && accSg === paradigm.get("genitive.sg")) flags.animate = true;
      const accPl = paradigm.get("accusative.pl");
      if (accPl !== undefined && accPl === paradigm.get("genitive.pl")) flags.personal = true;

      const hits = matched(lemma, paradigm, flags);
      if (best === undefined || hits > best.hits) best = { flags, hits };
    }
  }

  const flags = best?.flags ?? {};
  // Whatever is still wrong is stored whole. These are the cells where the
  // word is simply not built the way its shape suggests.
  const forms: Record<string, string> = {};
  for (const [plCase, plural] of CELLS) {
    const cell = `${plCase}.${plural ? "pl" : "sg"}`;
    const attested = paradigm.get(cell);
    if (attested !== undefined && declineNoun(lemma, plCase, plural, flags) !== attested) {
      forms[cell] = attested;
    }
  }
  if (Object.keys(forms).length > 0) flags.forms = forms;
  return flags;
}

/** Serialize the flags as `key=value` pairs, shortest first. */
const SLOT_CODE: Record<string, string> = {
  class: "c",
  stem: "s",
  genSg: "g",
  datSg: "d",
  locSg: "l",
  nomPl: "n",
  genPl: "p",
  animate: "A",
  personal: "P",
};

const CLASS_CODE: Record<PlClass, string> = {
  masculine: "m",
  "feminine-a": "f",
  neuter: "n",
  "feminine-consonant": "k",
};

function encode(flags: PlStemFlags): string {
  const parts: string[] = [];
  for (const [key, code] of Object.entries(SLOT_CODE)) {
    const value = (flags as Record<string, unknown>)[key];
    if (value === undefined) continue;
    if (value === true) parts.push(code);
    else if (key === "class") parts.push(`${code}${CLASS_CODE[value as PlClass]}`);
    else parts.push(`${code}${value}`);
  }
  for (const [cell, form] of Object.entries(flags.forms ?? {})) {
    parts.push(`*${cell}=${form}`);
  }
  return parts.join(",");
}

/**
 * A deterministic tenth of the corpus, held out so the lexicon can be
 * measured on words it has never seen. Everything else reports how well the
 * lexicon memorized its own input, which is not a number worth having.
 */
function heldOut(lemma: string): boolean {
  let hash = 2166136261;
  for (let i = 0; i < lemma.length; i++) {
    hash = Math.imul(hash ^ lemma.charCodeAt(i), 16777619);
  }
  return (hash >>> 0) % 10 === 0;
}

/** Build from nine tenths of the corpus and score the tenth left out. */
function evaluateHeldOut(): { right: number; of: number; lemmas: number } {
  const trained = new Map<string, ReturnType<typeof fit>>();
  for (const [lemma, paradigm] of corpus) {
    if (heldOut(lemma)) continue;
    const flags = fitParadigm(lemma, paradigm);
    if (Object.keys(flags).length > 0) trained.set(lemma.toLowerCase(), flags);
  }
  let right = 0;
  let of = 0;
  let lemmas = 0;
  for (const [lemma, paradigm] of corpus) {
    if (!heldOut(lemma)) continue;
    lemmas++;
    of += paradigm.size;
    right += matched(lemma, paradigm, trained.get(lemma.toLowerCase()) ?? {});
  }
  return { right, of, lemmas };
}

let cells = 0;
let byRules = 0;
let withLexicon = 0;
let lemmasPerfect = 0;
const lines: string[] = [];

for (const [lemma, paradigm] of [...corpus].sort(([a], [b]) => a.localeCompare(b, "pl"))) {
  const plain = matched(lemma, paradigm, {});
  const flags = fitParadigm(lemma, paradigm);
  cells += paradigm.size;
  byRules += plain;
  withLexicon += matched(lemma, paradigm, flags);
  if (plain === paradigm.size) {
    lemmasPerfect++;
    continue;
  }
  const encoded = encode(flags);
  // Keys are lowercased so that `Polak` and `polak` find the same entry.
  if (encoded.length > 0) lines.push(`${lemma.toLowerCase()}|${encoded}`);
}

const source = `/**
 * GENERATED FILE — Polish stem lexicon. DO NOT EDIT BY HAND.
 *
 * Emitted by data-pipeline/run-polish.ts from UniMorph pol
 * (https://github.com/unimorph/pol). Data licence: CC BY-SA — see
 * LICENSE-DATA.md.
 *
 * Each line is a lemma and the choices its paradigm makes, one letter per
 * choice:
 *
 *   c  declension class (m masculine, f -a feminine, n neuter, k
 *      consonant-final feminine) when the ending does not give it away
 *   s  the oblique stem, when the rules cannot derive it
 *   g  genitive singular ending      d  dative singular ending
 *   l  locative singular ending      n  nominative plural ending
 *   p  genitive plural ending
 *   A  animate: the accusative singular copies the genitive
 *   P  personal: the accusative plural copies the genitive too
 *   *case.number=form  a cell nothing shorter explains
 */
import type { PlClass, PlStemFlags } from "./declension.js";

const STEM_DATA = \`${lines.join("\n")}
\`;

const CLASSES: Record<string, PlClass> = {
  m: "masculine",
  f: "feminine-a",
  n: "neuter",
  k: "feminine-consonant",
};

function parse(spec: string): PlStemFlags {
  const flags: PlStemFlags = {};
  const forms: Record<string, string> = {};
  for (const part of spec.split(",")) {
    if (part.startsWith("*")) {
      const [cell, form] = part.slice(1).split("=") as [string, string];
      forms[cell] = form;
      continue;
    }
    const code = part[0] as string;
    const value = part.slice(1);
    if (code === "A") flags.animate = true;
    else if (code === "P") flags.personal = true;
    else if (code === "c") {
      const plClass = CLASSES[value];
      if (plClass !== undefined) flags.class = plClass;
    }
    else if (code === "s") flags.stem = value;
    else if (code === "g") flags.genSg = value;
    else if (code === "d") flags.datSg = value;
    else if (code === "l") flags.locSg = value;
    else if (code === "n") flags.nomPl = value;
    else if (code === "p") flags.genPl = value;
  }
  if (Object.keys(forms).length > 0) flags.forms = forms;
  return flags;
}

/** What each noun's paradigm does that the rules do not predict. */
export const STEM_FLAGS: ReadonlyMap<string, PlStemFlags> = new Map(
  STEM_DATA.split("\\n")
    .filter((line) => line.length > 0)
    .map((line) => {
      const [lemma, spec] = line.split("|") as [string, string];
      return [lemma, parse(spec)] as const;
    }),
);
`;

writeFileSync(TARGET, source);
console.log(`Polish: ${corpus.size} lemmas, ${cells} cells`);
console.log(`  rules alone:      ${((100 * byRules) / cells).toFixed(2)}%`);
console.log(`  rules + lexicon:  ${((100 * withLexicon) / cells).toFixed(2)}%`);
console.log(`  perfect by rules: ${lemmasPerfect} lemmas, ${lines.length} stored`);
console.log(`  → ${(gzipSync(source).length / 1024).toFixed(1)} kB gzipped`);

const honest = evaluateHeldOut();
console.log(
  `  held out (${honest.lemmas} unseen lemmas): ${((100 * honest.right) / honest.of).toFixed(2)}%`,
);
