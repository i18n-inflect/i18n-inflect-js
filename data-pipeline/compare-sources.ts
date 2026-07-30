/**
 * How much does Wiktionary add on top of UniMorph, and do they agree?
 *
 * Run before deciding to merge a source: extra vocabulary is only worth
 * having if it is consistent with what is already there.
 */
import { loadRows } from "./unimorph.js";
import { loadWiktionaryRows } from "./wiktionary.js";

const ROOT = new URL("..", import.meta.url).pathname;

const uni = loadRows(`${ROOT}data/raw/hun.tsv`);
const { rows: wik, stats } = await loadWiktionaryRows(`${ROOT}data/raw/hu-wiktionary.jsonl`);

console.log(`Wiktionary dump: ${stats.entries} entries, ${stats.nouns} Hungarian nouns`);
console.log(`  usable: ${stats.rows} forms over ${stats.lemmas} lemmas`);

const uniLemmas = new Set(uni.map((r) => r.lemma));
const wikLemmas = new Set(wik.map((r) => r.lemma));
const newLemmas = [...wikLemmas].filter((l) => !uniLemmas.has(l));
const shared = [...wikLemmas].filter((l) => uniLemmas.has(l));

console.log(`\nUniMorph lemmas:   ${uniLemmas.size}`);
console.log(`Wiktionary lemmas: ${wikLemmas.size}`);
console.log(`  shared:          ${shared.length}`);
console.log(`  new:             ${newLemmas.length}`);
console.log(`  sample new:      ${newLemmas.slice(0, 12).join(", ")}`);

// Do the two sources contradict each other where they overlap?
const uniForms = new Map<string, Set<string>>();
for (const r of uni) {
  const key = `${r.lemma}|${r.tag}`;
  const set = uniForms.get(key);
  if (set) set.add(r.form);
  else uniForms.set(key, new Set([r.form]));
}
let compared = 0;
let agree = 0;
const disagreements: string[] = [];
for (const r of wik) {
  const set = uniForms.get(`${r.lemma}|${r.tag}`);
  if (!set) continue;
  compared++;
  if (set.has(r.form)) agree++;
  else if (disagreements.length < 10) {
    disagreements.push(
      `${r.lemma} ${r.tag}: wiktionary "${r.form}" vs unimorph "${[...set].join("/")}"`,
    );
  }
}
console.log(`\noverlapping forms compared: ${compared}`);
console.log(`  identical: ${agree} (${((100 * agree) / compared).toFixed(2)}%)`);
for (const d of disagreements) console.log(`  ≠ ${d}`);
