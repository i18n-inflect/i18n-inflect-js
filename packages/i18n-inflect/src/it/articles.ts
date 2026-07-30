/**
 * Italian article selection, which is decided by the sound the following
 * word starts with rather than by its gender alone.
 *
 * Masculine words take `il`/`i` normally, but `lo`/`gli` before a consonant
 * cluster the language will not start a syllable with — s + consonant, z,
 * gn, ps, pn, x, y, and i before a vowel — and `l'`/`gli` before a vowel.
 */

export type ItGender = "masculine" | "feminine";

const VOWELS = new Set([..."aeiouàèéìòùAEIOUÀÈÉÌÒÙ"]);

/** True when the word begins with a vowel sound. */
export function startsWithVowel(word: string): boolean {
  const first = word[0];
  return first !== undefined && VOWELS.has(first);
}

/**
 * True when a masculine word needs `lo` rather than `il`: the clusters
 * Italian phonotactics will not allow after `il`.
 */
export function needsLo(word: string): boolean {
  const lower = word.toLowerCase();
  if (/^[sx][^aeiouàèéìòù]/.test(lower)) return true; // sport, sbaglio, xilofono
  if (/^(z|gn|ps|pn|pt)/.test(lower)) return true; // zaino, gnomo, psicologo
  if (/^i[aeiouàèéìòù]/.test(lower)) return true; // iato, iodio
  if (/^y/.test(lower)) return true; // yogurt
  return false;
}

/** The definite article for a word, given its gender and number. */
export function definiteArticle(word: string, gender: ItGender, plural: boolean): string {
  if (gender === "feminine") {
    if (plural) return "le";
    return startsWithVowel(word) ? "l'" : "la";
  }
  if (plural) return startsWithVowel(word) || needsLo(word) ? "gli" : "i";
  if (startsWithVowel(word)) return "l'";
  return needsLo(word) ? "lo" : "il";
}

/** The indefinite article. Plural indefinites use the partitive instead. */
export function indefiniteArticle(word: string, gender: ItGender): string {
  if (gender === "feminine") return startsWithVowel(word) ? "un'" : "una";
  return needsLo(word) ? "uno" : "un";
}

/** Articles that attach directly to the next word, with no space. */
export const ELIDED = new Set(["l'", "un'", "dell'", "all'", "dall'", "nell'", "sull'"]);

/**
 * Articulated prepositions: Italian fuses a preposition with the following
 * definite article into one word, and getting these right is most of what
 * makes generated Italian read naturally — *di il libro* is simply not
 * Italian, it is `del libro`.
 */
const PREPOSITIONS = {
  di: { il: "del", lo: "dello", "l'": "dell'", la: "della", i: "dei", gli: "degli", le: "delle" },
  a: { il: "al", lo: "allo", "l'": "all'", la: "alla", i: "ai", gli: "agli", le: "alle" },
  da: { il: "dal", lo: "dallo", "l'": "dall'", la: "dalla", i: "dai", gli: "dagli", le: "dalle" },
  in: { il: "nel", lo: "nello", "l'": "nell'", la: "nella", i: "nei", gli: "negli", le: "nelle" },
  su: { il: "sul", lo: "sullo", "l'": "sull'", la: "sulla", i: "sui", gli: "sugli", le: "sulle" },
} as const;

/** A preposition that fuses with the article. */
export type ItPreposition = keyof typeof PREPOSITIONS;

export function isPreposition(value: string): value is ItPreposition {
  return value in PREPOSITIONS;
}

/** Fuse a preposition with the article a word would take. */
export function articulated(
  preposition: ItPreposition,
  word: string,
  gender: ItGender,
  plural: boolean,
): string {
  const article = definiteArticle(word, gender, plural) as keyof (typeof PREPOSITIONS)["di"];
  return PREPOSITIONS[preposition][article];
}
