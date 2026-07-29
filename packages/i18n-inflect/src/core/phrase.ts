/**
 * Whitespace-preserving phrase tokenization shared by the language packs.
 *
 * A phrase is split into alternating word/separator parts so packs can
 * rewrite individual words (head noun, article, adjectives) and reassemble
 * the phrase without disturbing its original spacing.
 */

/** A phrase split into parts; `words[i]` sits between separators. */
export interface SplitPhrase {
  /** The word tokens, in order. */
  words: string[];
  /**
   * All parts (words and whitespace runs) in original order. Rewriting
   * `parts[wordIndexes[i]]` and joining reproduces the phrase.
   */
  parts: string[];
  /** Index into `parts` for each entry of `words`. */
  wordIndexes: number[];
}

/** Split a phrase, keeping whitespace runs as separate parts. */
export function splitPhrase(phrase: string): SplitPhrase {
  const parts = phrase.split(/(\s+)/);
  const words: string[] = [];
  const wordIndexes: number[] = [];
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    if (part !== undefined && part.length > 0 && !/^\s+$/.test(part)) {
      words.push(part);
      wordIndexes.push(i);
    }
  }
  return { words, parts, wordIndexes };
}

/** Reassemble a phrase after rewriting some of its `parts`. */
export function joinPhrase(split: SplitPhrase): string {
  return split.parts.join("");
}

/**
 * Split a token into its core and trailing punctuation
 * (`"ász!"` → `["ász", "!"]`) so suffixes attach to the word itself.
 */
export function splitTrailingPunctuation(token: string): [core: string, punctuation: string] {
  const match = /^(.*?)([.,;:!?…)»”'"]*)$/.exec(token);
  return match ? [match[1] ?? token, match[2] ?? ""] : [token, ""];
}

/** True when `word`'s first letter is uppercase (locale-independent check). */
export function isCapitalized(word: string): boolean {
  const first = word[0];
  return first !== undefined && first !== first.toLowerCase();
}

/** Capitalize the first letter of `word`. */
export function capitalize(word: string): string {
  return word.length === 0 ? word : (word[0] as string).toUpperCase() + word.slice(1);
}
