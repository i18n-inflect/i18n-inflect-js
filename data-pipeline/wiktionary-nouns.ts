/**
 * Gender and plural for nouns, from the wiktextract dumps at kaikki.org.
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

export type NounGender = "masculine" | "feminine" | "neuter";

export interface WiktionaryNoun {
  lemma: string;
  gender: NounGender;
  /** The attested plural, when the dump records exactly one. */
  plural?: string;
}

interface Entry {
  senses?: unknown[];
  word?: string;
  pos?: string;
  lang_code?: string;
  head_templates?: { name?: string; args?: Record<string, string> }[];
  forms?: { form?: string; tags?: string[] }[];
}

/**
 * The `xx-noun` head template carries the gender in its first argument. The
 * shape varies by language: Romance templates hold just `m` or `f`, while
 * the German one packs the declension in too — `n,,^er` for `Haus`.
 */
function genderOf(entry: Entry, template: string): NounGender | undefined {
  for (const head of entry.head_templates ?? []) {
    if (head.name !== template) continue;
    const raw = (head.args?.["1"] ?? head.args?.g ?? "").split(",")[0]?.trim();
    if (raw === "m" || raw === "mf" || raw === "m-p") return "masculine";
    if (raw === "f" || raw === "f-p") return "feminine";
    if (raw === "n" || raw === "n-p") return "neuter";
  }
  return undefined;
}

/** The single attested plural, if the entry records exactly one. */
function pluralOf(entry: Entry): string | undefined {
  const plurals = new Set<string>();
  for (const form of entry.forms ?? []) {
    if (!form.tags?.includes("plural")) continue;
    if (form.tags.includes("possessive") || form.tags.includes("table-tags")) continue;
    // German tables repeat the plural once per case; only the bare one is
    // the citation form.
    if (form.tags.length > 1 && form.tags.some((t) => t !== "plural" && t !== "nominative")) {
      continue;
    }
    const value = form.form?.normalize("NFC").trim();
    if (value && !value.includes(" ") && value !== "-") plurals.add(value);
  }
  return plurals.size === 1 ? [...plurals][0] : undefined;
}

/** Read every noun of one language out of its dump. */
export async function loadWiktionaryNouns(
  path: string,
  langCode: string,
  options: { allowCapitalized?: boolean } = {},
): Promise<WiktionaryNoun[]> {
  if (!existsSync(path)) throw new Error(`dump not found at ${path}`);
  const template = `${langCode}-noun`;
  /** The entry kept per lemma, with the evidence that won it its place. */
  const byLemma = new Map<string, { noun: WiktionaryNoun; senses: number }>();

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
    if (!lemma || lemma.includes(" ")) continue;
    // German capitalizes every noun; elsewhere a capital marks a proper name.
    if (!options.allowCapitalized && /^\p{Lu}/u.test(lemma)) continue;

    const gender = genderOf(entry, template);
    if (gender === undefined) continue;

    // One spelling can be two words: `o coração` (heart) and `a coração`
    // (blushing), `der Tag` (day) and the borrowed `das Tag`. The string
    // cannot say which is meant, so the better-attested one wins — the
    // caller can always pass `gender:` for the other.
    const senses = entry.senses?.length ?? 0;
    const existing = byLemma.get(lemma);
    if (existing !== undefined && senses <= existing.senses) continue;

    const plural = pluralOf(entry);
    byLemma.set(lemma, {
      noun: plural === undefined ? { lemma, gender } : { lemma, gender, plural },
      senses,
    });
  }

  return [...byLemma.values()].map((entry) => entry.noun);
}
