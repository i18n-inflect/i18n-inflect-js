/**
 * Error analysis for the Hungarian RULE LAYER.
 *
 * Measures `inflectNounRules` plus stem flags and compound resolution — not
 * the language pack, which additionally consults full-form overrides and
 * hyphen classes and is therefore more accurate. The point is to show where
 * rules alone fall short, so improvements can be aimed at the largest class
 * rather than at whatever example is at hand. For what users actually get,
 * see the golden test.
 */
import { resolveStemFlags } from "../packages/i18n-inflect/src/hu/compounds.js";
import {
  STEM_FLAGS,
  UNSAFE_COMPOUND_HEADS,
} from "../packages/i18n-inflect/src/hu/exceptions.gen.js";
import {
  BACK_NEUTRAL_LEMMAS,
  harmonyOf,
  vowelsOf,
} from "../packages/i18n-inflect/src/hu/phonology.js";
import { inflectNounRules } from "../packages/i18n-inflect/src/hu/suffixes.js";
import { HU_CASE_TAGS, type HuCase } from "../packages/i18n-inflect/src/hu/tags.js";
import { groupByLemma, isHeldOut, loadRows, parseTag } from "./unimorph.js";
import { loadWiktionaryRows } from "./wiktionary.js";

const TAG_TO_CASE = new Map<string, HuCase>(
  (Object.entries(HU_CASE_TAGS) as [HuCase, string][]).map(([c, t]) => [t, c]),
);

/** Longest known lexicon lemma that this word ends with (compound head). */
function compoundHead(lemma: string): string | undefined {
  let best: string | undefined;
  for (let i = 1; i < lemma.length - 1; i++) {
    const tail = lemma.slice(i);
    if (
      tail.length >= 2 &&
      STEM_FLAGS.has(tail) &&
      (best === undefined || tail.length > best.length)
    ) {
      best = tail;
    }
  }
  return best;
}

const HEADS = new Set([...STEM_FLAGS.keys()].filter((h) => !UNSAFE_COMPOUND_HEADS.has(h)));
const ROOT = new URL("..", import.meta.url).pathname;
const rows = loadRows(`${ROOT}data/raw/hun.tsv`);
const { rows: extra } = await loadWiktionaryRows(`${ROOT}data/raw/hu-wiktionary.jsonl`);
const known = new Set(rows.map((r) => `${r.lemma} ${r.tag} ${r.form}`));
for (const row of extra) if (!known.has(`${row.lemma} ${row.tag} ${row.form}`)) rows.push(row);
const heldOut = rows.filter((r) => isHeldOut(r.lemma));
const classes = new Map<string, { forms: number; lemmas: Set<string>; sample: string[] }>();
let total = 0;
let wrong = 0;

for (const [lemma, forms] of groupByLemma(heldOut)) {
  for (const [tag, accepted] of forms) {
    total++;
    const { caseTag, plural } = parseTag(tag);
    const huCase = caseTag === "NOM" ? undefined : TAG_TO_CASE.get(caseTag);
    const got = inflectNounRules(
      lemma,
      resolveStemFlags(lemma, STEM_FLAGS, HEADS, BACK_NEUTRAL_LEMMAS, UNSAFE_COMPOUND_HEADS),
      plural,
      huCase,
      BACK_NEUTRAL_LEMMAS,
    );
    if (accepted.includes(got)) continue;
    wrong++;
    if (accepted.length > 1) {
      const e = classes.get("szabad változat — a másik alakot adtuk") ?? {
        forms: 0,
        lemmas: new Set<string>(),
        sample: [],
      };
      e.forms++;
      e.lemmas.add(lemma);
      if (e.sample.length < 3) e.sample.push(`${lemma} ${tag}: ${got} vs ${accepted.join("/")}`);
      classes.set("szabad változat — a másik alakot adtuk", e);
      continue;
    }

    const head = compoundHead(lemma);
    const vowels = vowelsOf(lemma);
    let cls: string;
    if (accepted.some((f) => f.startsWith(`${lemma}-`))) cls = "kötőjeles (rövidítés/idegen)";
    else if (head) cls = "összetett szó — az utótag sem elég";
    else if (vowels.every((v) => "iíé".includes(v))) cls = "csupa semleges magánhangzó (hangrend)";
    else if (/[qwx]|(?<![glnt])y/.test(lemma)) cls = "idegen betű";
    else if (new Set(vowels.map((v) => (harmonyOf(v) === "back" ? "b" : "f"))).size > 1)
      cls = lemma.length >= 9 ? "vegyes hangrend — valószínűleg összetett" : "vegyes hangrendű tő";
    else cls = "egyéb (tőváltakozás/kötőhang)";

    let entry = classes.get(cls);
    if (!entry) {
      entry = { forms: 0, lemmas: new Set(), sample: [] };
      classes.set(cls, entry);
    }
    entry.forms++;
    entry.lemmas.add(lemma);
    if (entry.sample.length < 3) entry.sample.push(`${lemma} ${tag}: ${got} ≠ ${accepted[0]}`);
  }
}

console.log(`held-out: ${total} alak, hibás: ${wrong} (${((100 * wrong) / total).toFixed(2)}%)\n`);
for (const [cls, e] of [...classes].sort((a, b) => b[1].forms - a[1].forms)) {
  console.log(
    `${((100 * e.forms) / total).toFixed(2)}%  ${e.forms.toString().padStart(5)} alak  ${e.lemmas.size.toString().padStart(4)} lemma  ${cls}`,
  );
  for (const s of e.sample) console.log(`         ${s}`);
}
