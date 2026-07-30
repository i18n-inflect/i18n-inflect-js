/**
 * Hungarian nouns from Wiktionary, via the wiktextract machine-readable
 * dump published at kaikki.org.
 *
 * UniMorph's Hungarian data is itself a Wiktionary extraction, but pinned to
 * 2023 and limited to what UniMorph chose to include. Reading the current
 * dump directly gets both a larger vocabulary and fresher paradigms, in the
 * same shape, so the rest of the pipeline needs no changes.
 *
 * The dump is a JSON object per line and is far too large to hold in memory,
 * so it is streamed.
 *
 * Data licence: CC BY-SA, as Wiktionary derivatives — the same terms the
 * generated lexicon already carries.
 */
import { createReadStream, existsSync } from "node:fs";
import { createInterface } from "node:readline";
import type { Row } from "./unimorph.js";

export const WIKTIONARY_URL =
  "https://kaikki.org/dictionary/Hungarian/kaikki.org-dictionary-Hungarian.jsonl";

/** Wiktionary's case names → the UniMorph tags the pipeline speaks. */
const CASE_TAGS: Record<string, string> = {
  nominative: "NOM",
  accusative: "ACC",
  dative: "DAT",
  instrumental: "INS",
  "causal-final": "PRP",
  translative: "TRANS",
  terminative: "TERM",
  inessive: "IN+ESS",
  elative: "IN+ABL",
  illative: "IN+ALL",
  superessive: "ON+ESS",
  delative: "ON+ABL",
  sublative: "ON+ALL",
  adessive: "AT+ESS",
  ablative: "AT+ABL",
  allative: "AT+ALL",
};

interface WiktionaryForm {
  form: string;
  tags?: string[];
  source?: string;
}

interface WiktionaryEntry {
  word?: string;
  pos?: string;
  lang_code?: string;
  forms?: WiktionaryForm[];
  head_templates?: { name?: string }[];
}

/** What a pass over the dump found, for the pipeline's report. */
export interface WiktionaryStats {
  entries: number;
  nouns: number;
  lemmas: number;
  rows: number;
}

/**
 * Read the dump and return rows in the same shape as the UniMorph loader.
 *
 * Applies the same filters: single-word, lowercase-initial lemmas, NFC
 * normalization, and only the tags the engine claims to produce.
 */
export async function loadWiktionaryRows(
  path: string,
): Promise<{ rows: Row[]; stats: WiktionaryStats }> {
  if (!existsSync(path)) throw new Error(`Wiktionary dump not found at ${path}`);
  const rows: Row[] = [];
  const seen = new Set<string>();
  const lemmas = new Set<string>();
  const stats: WiktionaryStats = { entries: 0, nouns: 0, lemmas: 0, rows: 0 };

  const reader = createInterface({
    input: createReadStream(path, { encoding: "utf8" }),
    crlfDelay: Number.POSITIVE_INFINITY,
  });

  for await (const line of reader) {
    if (line.length === 0) continue;
    stats.entries++;
    let entry: WiktionaryEntry;
    try {
      entry = JSON.parse(line) as WiktionaryEntry;
    } catch {
      continue; // a malformed line must not abort a 580 MB pass
    }
    if (entry.pos !== "noun" || entry.lang_code !== "hu") continue;
    // Wiktionary also has entries for inflected forms — `abakuszai` is the
    // possessive plural of `abakusz`, not a lemma. Dictionary entries carry
    // the `hu-noun` head template; form entries only carry a generic one.
    if (!entry.head_templates?.some((t) => t.name === "hu-noun")) continue;
    stats.nouns++;

    const lemma = entry.word?.normalize("NFC").trim();
    if (!lemma || lemma.includes(" ") || /^[A-ZÁÉÍÓÖŐÚÜŰ]/.test(lemma)) continue;

    for (const form of entry.forms ?? []) {
      if (form.source !== "declension") continue;
      const tags = form.tags ?? [];
      if (tags.includes("error-unrecognized-form") || tags.includes("class")) continue;
      // Possessive and essive forms are real, but outside what the engine
      // claims to produce; including them would poison the diff.
      if (tags.some((t) => t.startsWith("possess") || t.startsWith("essive"))) continue;

      const caseTag = tags.map((t) => CASE_TAGS[t]).find((t) => t !== undefined);
      if (caseTag === undefined) continue;
      const number = tags.includes("plural") ? "PL" : tags.includes("singular") ? "SG" : undefined;
      if (number === undefined) continue;
      // The nominative singular is the lemma itself: it carries no
      // information, and including it would break the detection of words
      // that take every suffix after a hyphen (house-t, kft.-vel), whose
      // bare form is naturally not hyphenated.
      if (caseTag === "NOM" && number === "SG") continue;

      const surface = form.form?.normalize("NFC").trim();
      if (!surface || surface.includes(" ") || surface === "-") continue;

      const tag = `N;${caseTag};${number}`;
      const key = `${lemma} ${tag} ${surface}`;
      if (seen.has(key)) continue;
      seen.add(key);
      lemmas.add(lemma);
      rows.push({ lemma, tag, form: surface });
    }
  }

  stats.lemmas = lemmas.size;
  stats.rows = rows.length;
  return { rows, stats };
}
