/**
 * Turkish phonology.
 *
 * Turkish is agglutinative like Hungarian, so the same shape of machinery
 * applies — but where Hungarian harmony has two axes, Turkish has two
 * separate harmony systems that pick different suffix vowels, and it also
 * changes the *stem* where a suffix meets it.
 */

/** Back vowels: they select `a` and `ı` class suffixes. */
const BACK = new Set([..."aıou"]);
/** Rounded vowels: with backness they select the four-way vowel. */
const ROUNDED = new Set([..."ouöü"]);

const VOWELS = "aeıioöuü";

/** Consonants that devoice a following `d`: locative `-de` → `-te`. */
const VOICELESS = new Set([..."fstkçşhp"]);

/** The last vowel of a word, which every suffix harmonizes with. */
export function lastVowel(word: string): string | undefined {
  const lower = word.toLowerCase();
  for (let i = lower.length - 1; i >= 0; i--) {
    const ch = lower[i] as string;
    if (VOWELS.includes(ch)) return ch;
  }
  return undefined;
}

export function endsInVowel(word: string): boolean {
  const last = word.at(-1)?.toLowerCase();
  return last !== undefined && VOWELS.includes(last);
}

/**
 * Two-way harmony, the `a`/`e` alternation: `-lar` after a back vowel,
 * `-ler` after a front one.
 */
export function lowVowel(word: string): "a" | "e" {
  const vowel = lastVowel(word);
  return vowel !== undefined && BACK.has(vowel) ? "a" : "e";
}

/**
 * Four-way harmony, the `ı`/`i`/`u`/`ü` alternation: backness and rounding
 * are both copied from the last vowel. `kitabı`, `evi`, `okulu`, `gözü`.
 */
export function highVowel(word: string): "ı" | "i" | "u" | "ü" {
  const vowel = lastVowel(word);
  if (vowel === undefined) return "i";
  const back = BACK.has(vowel);
  const rounded = ROUNDED.has(vowel);
  if (back) return rounded ? "u" : "ı";
  return rounded ? "ü" : "i";
}

/** True when a `d`-initial suffix must be written with `t` instead. */
export function devoices(word: string): boolean {
  const last = word.at(-1)?.toLowerCase();
  return last !== undefined && VOICELESS.has(last);
}

/**
 * Final-consonant softening: `p ç t k` voice to `b c d ğ` when a vowel
 * follows — `kitap` → `kitabı`, `ağaç` → `ağacı`, `sokak` → `sokağı`.
 *
 * Whether a word softens at all is lexical, not phonological: `kitap`
 * softens but `top` does not, and nothing in the spelling says which. The
 * generated lexicon carries the exceptions; this function applies the
 * productive rule.
 */
const SOFTENING: Record<string, string> = { p: "b", ç: "c", t: "d", k: "ğ" };

export function soften(word: string): string {
  const last = word.at(-1) as string | undefined;
  if (last === undefined) return word;
  // "nk" softens to "ng" rather than "nğ": renk → rengi.
  if (last.toLowerCase() === "k" && word.at(-2)?.toLowerCase() === "n") {
    return `${word.slice(0, -1)}g`;
  }
  const soft = SOFTENING[last.toLowerCase()];
  if (soft === undefined) return word;
  return word.slice(0, -1) + (last === last.toUpperCase() ? soft.toUpperCase() : soft);
}

/** True when the word could soften, before the lexicon has its say. */
export function canSoften(word: string): boolean {
  const last = word.at(-1)?.toLowerCase();
  return last !== undefined && last in SOFTENING;
}
