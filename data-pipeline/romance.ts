/**
 * Gender and plural for Spanish and Italian nouns, from the wiktextract
 * dumps at kaikki.org.
 *
 * Both languages hang most of their agreement on gender, which is lexical:
 * `el mapa` and `la mano` contradict the endings everybody teaches. Without
 * a lexicon the caller has to pass `gender` on every call, which is exactly
 * the kind of work a library should be doing for them.
 *
 * The dumps also carry the attested plural, so the same pass produces both.
 *
 * Data licence: CC BY-SA, as Wiktionary derivatives.
 */
import { createReadStream, existsSync } from "node:fs";
import { createInterface } from "node:readline";

export interface RomanceNoun {
  lemma: string;
  gender: "masculine" | "feminine";
  /** The attested plural, when the dump records exactly one. */
  plural?: string;
}

interface Entry {
  word?: string;
  pos?: string;
  lang_code?: string;
  head_templates?: { name?: string; args?: Record<string, string> }[];
  forms?: { form?: string; tags?: string[] }[];
}

/** The `it-noun` / `es-noun` templates put the gender in their first argument. */
function genderOf(entry: Entry, template: string): RomanceNoun["gender"] | undefined {
  for (const head of entry.head_templates ?? []) {
    if (head.name !== template) continue;
    const raw = head.args?.["1"] ?? head.args?.g;
    if (raw === "m" || raw === "mf" || raw === "m-p") return "masculine";
    if (raw === "f" || raw === "f-p") return "feminine";
  }
  return undefined;
}

/** The single attested plural, if the entry records exactly one. */
function pluralOf(entry: Entry): string | undefined {
  const plurals = new Set<string>();
  for (const form of entry.forms ?? []) {
    if (!form.tags?.includes("plural")) continue;
    if (form.tags.includes("possessive") || form.tags.includes("table-tags")) continue;
    const value = form.form?.normalize("NFC").trim();
    if (value && !value.includes(" ") && value !== "-") plurals.add(value);
  }
  return plurals.size === 1 ? [...plurals][0] : undefined;
}

/** Read every noun of one language out of its dump. */
export async function loadRomanceNouns(path: string, langCode: string): Promise<RomanceNoun[]> {
  if (!existsSync(path)) throw new Error(`dump not found at ${path}`);
  const template = `${langCode}-noun`;
  const byLemma = new Map<string, RomanceNoun>();

  const reader = createInterface({
    input: createReadStream(path, { encoding: "utf8" }),
    crlfDelay: Number.POSITIVE_INFINITY,
  });

  for await (const line of reader) {
    if (line.length === 0) continue;
    let entry: Entry;
    try {
      entry = JSON.parse(line) as Entry;
    } catch {
      continue;
    }
    if (entry.pos !== "noun" || entry.lang_code !== langCode) continue;
    const lemma = entry.word?.normalize("NFC").trim();
    if (!lemma || lemma.includes(" ") || /^\p{Lu}/u.test(lemma)) continue;

    const gender = genderOf(entry, template);
    if (gender === undefined) continue;

    const existing = byLemma.get(lemma);
    if (existing && existing.gender !== gender) {
      // A word with two genders (el capital / la capital) cannot be resolved
      // from the string, so it is better left to the caller's `gender`.
      byLemma.delete(lemma);
      continue;
    }
    const plural = pluralOf(entry);
    byLemma.set(lemma, plural === undefined ? { lemma, gender } : { lemma, gender, plural });
  }

  return [...byLemma.values()];
}
