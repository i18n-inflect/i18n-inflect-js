/** English noun pluralization: regular rules plus the core irregulars. */

const IRREGULAR: Record<string, string> = {
  child: "children",
  foot: "feet",
  goose: "geese",
  louse: "lice",
  man: "men",
  mouse: "mice",
  ox: "oxen",
  person: "people",
  tooth: "teeth",
  woman: "women",
  die: "dice",
};

/** Nouns whose plural equals the singular. */
const INVARIANT = new Set([
  "aircraft",
  "deer",
  "fish",
  "moose",
  "series",
  "sheep",
  "species",
  "swine",
]);

/** `-f`/`-fe` nouns that take `-ves`. */
const F_TO_VES = new Set([
  "calf",
  "elf",
  "half",
  "knife",
  "leaf",
  "life",
  "loaf",
  "self",
  "shelf",
  "thief",
  "wife",
  "wolf",
]);

/** `-o` nouns that take `-oes` (the rest just take `-s`). */
const O_TO_OES = new Set(["echo", "hero", "potato", "tomato", "torpedo", "veto"]);

/**
 * Pluralize an English noun. Preserves initial capitalization; ALL-CAPS
 * acronyms take a plain `s` ("APIs" is left to the caller's style — we emit
 * "APIS"-avoiding lowercase `s`).
 */
export function pluralize(word: string): string {
  if (/^[A-Z][A-Z0-9]+$/.test(word)) return `${word}s`; // acronym: PDF → PDFs
  const lower = word.toLowerCase();
  const capitalized = word[0] !== undefined && word[0] !== lower[0];
  const restore = (plural: string): string =>
    capitalized ? (plural[0] as string).toUpperCase() + plural.slice(1) : plural;

  if (INVARIANT.has(lower)) return word;
  const irregular = IRREGULAR[lower];
  if (irregular) return restore(irregular);
  if (F_TO_VES.has(lower)) {
    return restore(`${lower.replace(/fe?$/, "")}ves`);
  }
  if (/[^aeiou]y$/.test(lower)) return restore(`${lower.slice(0, -1)}ies`);
  if (/(s|x|z|ch|sh)$/.test(lower)) return restore(`${lower}es`);
  if (lower.endsWith("o") && O_TO_OES.has(lower)) return restore(`${lower}es`);
  return `${word}s`;
}
