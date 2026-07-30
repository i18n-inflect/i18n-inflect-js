/**
 * Error analysis for the Hungarian rule engine on held-out lemmas.
 *
 * Classifies each wrong form so improvements can be aimed at the largest
 * class rather than at whatever example happens to be at hand.
 */
import { resolveStemFlags } from "../packages/i18n-inflect/src/hu/compounds.js";
import { STEM_FLAGS } from "../packages/i18n-inflect/src/hu/exceptions.gen.js";
import {
  BACK_NEUTRAL_LEMMAS,
  harmonyOf,
  vowelsOf,
} from "../packages/i18n-inflect/src/hu/phonology.js";
import { inflectNounRules } from "../packages/i18n-inflect/src/hu/suffixes.js";
import { HU_CASE_TAGS, type HuCase } from "../packages/i18n-inflect/src/hu/tags.js";
import { groupByLemma, isHeldOut, loadRows, parseTag } from "./unimorph.js";

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

const HEADS = new Set(STEM_FLAGS.keys());
const rows = loadRows(`${new URL("..", import.meta.url).pathname}data/raw/hun.tsv`);
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
      resolveStemFlags(lemma, STEM_FLAGS, HEADS, BACK_NEUTRAL_LEMMAS),
      plural,
      huCase,
      BACK_NEUTRAL_LEMMAS,
    );
    if (accepted.includes(got)) continue;
    wrong++;

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
