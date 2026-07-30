/**
 * Generate the Russian stem lexicon.
 *
 * Usage: `pnpm pipeline:ru`
 *
 * Russian endings come in hard/soft pairs, and one choice per noun runs
 * through the whole paradigm — so most of a noun's twelve cells are not
 * facts to be stored but consequences to be derived. What is left is a
 * short list of choices: is `-ь` masculine or feminine, does a vowel drop
 * out of the stem, where does the stress fall (which decides `-ом` against
 * `-ем`), and is the thing alive.
 *
 * Each choice governs its own cells and no other, so they are fitted one at
 * a time rather than searched together, and only the cells no choice
 * explains are stored whole.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import {
  declineNoun,
  guessClass,
  type RuCase,
  type RuClass,
  type RuStemFlags,
} from "../packages/i18n-inflect/src/ru/declension.js";

const ROOT = new URL("..", import.meta.url).pathname;
const RAW = `${ROOT}data/raw/rus.tsv`;
const TARGET = `${ROOT}packages/i18n-inflect/src/ru/exceptions.gen.ts`;

/** UniMorph tags the prepositional `ESS`. */
const TAG_TO_CASE: Record<string, RuCase> = {
  NOM: "nominative",
  GEN: "genitive",
  DAT: "dative",
  ACC: "accusative",
  INS: "instrumental",
  ESS: "prepositional",
};

const CLASSES: RuClass[] = ["masculine", "feminine-a", "neuter", "feminine-soft"];

/** What each slot is allowed to be, in the order the fitter prefers them. */
const CANDIDATES = {
  genSg: ["а", "я", "у", "и", "ы"],
  datSg: ["у", "ю", "е", "и"],
  insSg: ["ом", "ем", "ой", "ей", "ью", "ёй", "ём"],
  prepSg: ["е", "и", "у", "ю"],
  nomPl: ["ы", "и", "а", "я", "е", "ья"],
  genPl: ["ов", "ев", "ей", "", "й", "ёв"],
} as const;

if (!existsSync(RAW)) {
  console.error(`Russian UniMorph not found at ${RAW}`);
  console.error(
    "  curl -Lo data/raw/rus.tsv https://raw.githubusercontent.com/unimorph/rus/master/rus",
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
  const ruCase = TAG_TO_CASE[parts[1] as string];
  const number = parts[2] === "PL" ? "pl" : parts[2] === "SG" ? "sg" : undefined;
  if (ruCase === undefined || number === undefined) continue;
  if (lemma.includes(" ") || form.includes(" ")) continue;

  const key = lemma.normalize("NFC");
  let paradigm = corpus.get(key);
  if (!paradigm) {
    paradigm = new Map();
    corpus.set(key, paradigm);
  }
  // A cell with two attested forms keeps the first; the alternative is a
  // variant, not a different answer.
  const cell = `${ruCase}.${number}`;
  if (!paradigm.has(cell)) paradigm.set(cell, form.normalize("NFC"));
}

const CELLS: [RuCase, boolean][] = [];
for (const ruCase of Object.values(TAG_TO_CASE)) {
  CELLS.push([ruCase, false], [ruCase, true]);
}

function matched(lemma: string, paradigm: Paradigm, flags: RuStemFlags): number {
  let hits = 0;
  for (const [ruCase, plural] of CELLS) {
    const attested = paradigm.get(`${ruCase}.${plural ? "pl" : "sg"}`);
    if (attested !== undefined && declineNoun(lemma, ruCase, plural, flags) === attested) hits++;
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
  flags: RuStemFlags,
  slot: keyof typeof CANDIDATES,
  cell: string,
): void {
  const attested = paradigm.get(cell);
  if (attested === undefined) return;
  const [ruCase, number] = cell.split(".") as [RuCase, string];
  const plural = number === "pl";
  if (declineNoun(lemma, ruCase, plural, flags) === attested) return;
  for (const value of CANDIDATES[slot]) {
    const trial = { ...flags, [slot]: value };
    if (declineNoun(lemma, ruCase, plural, trial) === attested) {
      (flags as Record<string, unknown>)[slot] = value;
      return;
    }
  }
}

/**
 * The stem every noun shares: the dative plural is stem + `-ам`/`-ям` with
 * no exceptions, so it says outright what the oblique stem is.
 */
function stemFromCorpus(paradigm: Paradigm): string | undefined {
  const datPl = paradigm.get("dative.pl");
  if (datPl === undefined) return undefined;
  return /[ая]м$/.test(datPl) ? datPl.slice(0, -2) : undefined;
}

function fitParadigm(lemma: string, paradigm: Paradigm): RuStemFlags {
  let best: { flags: RuStemFlags; hits: number } | undefined;

  for (const ruClass of CLASSES) {
    for (const stem of [undefined, stemFromCorpus(paradigm)]) {
      for (const soft of [undefined, true, false]) {
        const flags: RuStemFlags = {};
        if (ruClass !== guessClass(lemma)) flags.class = ruClass;
        if (stem !== undefined) flags.stem = stem;
        if (soft !== undefined) flags.soft = soft;

        fitSlot(lemma, paradigm, flags, "genSg", "genitive.sg");
        fitSlot(lemma, paradigm, flags, "datSg", "dative.sg");
        fitSlot(lemma, paradigm, flags, "insSg", "instrumental.sg");
        fitSlot(lemma, paradigm, flags, "prepSg", "prepositional.sg");
        fitSlot(lemma, paradigm, flags, "nomPl", "nominative.pl");
        fitSlot(lemma, paradigm, flags, "genPl", "genitive.pl");

        // Animacy is not a spelling fact but a syntactic one: it shows up
        // as the accusative copying the genitive. Either number is enough
        // evidence — UniMorph records the plural less often than the
        // singular, and a noun is alive in both.
        const accSg = paradigm.get("accusative.sg");
        const accPl = paradigm.get("accusative.pl");
        if (
          (accSg !== undefined && accSg === paradigm.get("genitive.sg")) ||
          (accPl !== undefined && accPl === paradigm.get("genitive.pl"))
        ) {
          flags.animate = true;
        }

        const hits = matched(lemma, paradigm, flags);
        if (best === undefined || hits > best.hits) best = { flags, hits };
      }
    }
  }

  const flags = best?.flags ?? {};
  // Whatever is still wrong is stored whole. These are the cells where the
  // word is simply not built the way its shape suggests.
  const forms: Record<string, string> = {};
  for (const [ruCase, plural] of CELLS) {
    const cell = `${ruCase}.${plural ? "pl" : "sg"}`;
    const attested = paradigm.get(cell);
    if (attested !== undefined && declineNoun(lemma, ruCase, plural, flags) !== attested) {
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
  insSg: "i",
  prepSg: "l",
  nomPl: "n",
  genPl: "p",
  soft: "S",
  animate: "A",
};

const CLASS_CODE: Record<RuClass, string> = {
  masculine: "m",
  "feminine-a": "f",
  neuter: "n",
  "feminine-soft": "k",
};

function encode(flags: RuStemFlags): string {
  const parts: string[] = [];
  for (const [key, code] of Object.entries(SLOT_CODE)) {
    const value = (flags as Record<string, unknown>)[key];
    if (value === undefined) continue;
    if (value === true) parts.push(code);
    else if (value === false) parts.push(`${code}0`);
    else if (key === "class") parts.push(`${code}${CLASS_CODE[value as RuClass]}`);
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

for (const [lemma, paradigm] of [...corpus].sort(([a], [b]) => a.localeCompare(b, "ru"))) {
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
import type { RuClass, RuStemFlags } from "./declension.js";

const STEM_DATA = \`${lines.join("\n")}
\`;

const CLASSES: Record<string, RuClass> = {
  m: "masculine",
  f: "feminine-a",
  n: "neuter",
  k: "feminine-soft",
};

function parse(spec: string): RuStemFlags {
  const flags: RuStemFlags = {};
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
    else if (code === "S") flags.soft = value !== "0";
    else if (code === "c") {
      const plClass = CLASSES[value];
      if (plClass !== undefined) flags.class = plClass;
    }
    else if (code === "s") flags.stem = value;
    else if (code === "g") flags.genSg = value;
    else if (code === "d") flags.datSg = value;
    else if (code === "i") flags.insSg = value;
    else if (code === "l") flags.prepSg = value;
    else if (code === "n") flags.nomPl = value;
    else if (code === "p") flags.genPl = value;
  }
  if (Object.keys(forms).length > 0) flags.forms = forms;
  return flags;
}

/** What each noun's paradigm does that the rules do not predict. */
export const STEM_FLAGS: ReadonlyMap<string, RuStemFlags> = new Map(
  STEM_DATA.split("\\n")
    .filter((line) => line.length > 0)
    .map((line) => {
      const [lemma, spec] = line.split("|") as [string, string];
      return [lemma, parse(spec)] as const;
    }),
);
`;

writeFileSync(TARGET, source);
console.log(`Russian: ${corpus.size} lemmas, ${cells} cells`);
console.log(`  rules alone:      ${((100 * byRules) / cells).toFixed(2)}%`);
console.log(`  rules + lexicon:  ${((100 * withLexicon) / cells).toFixed(2)}%`);
console.log(`  perfect by rules: ${lemmasPerfect} lemmas, ${lines.length} stored`);
console.log(`  → ${(gzipSync(source).length / 1024).toFixed(1)} kB gzipped`);

const honest = evaluateHeldOut();
console.log(
  `  held out (${honest.lemmas} unseen lemmas): ${((100 * honest.right) / honest.of).toFixed(2)}%`,
);
