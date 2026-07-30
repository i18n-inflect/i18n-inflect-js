import { canSoften, devoices, endsInVowel, highVowel, lowVowel, soften } from "./phonology.js";

/**
 * Turkish case suffixes.
 *
 * Three things happen where a suffix meets a stem: the suffix vowel
 * harmonizes, a `d` devoices to `t` after a voiceless consonant, and a
 * buffer consonant appears to keep two vowels apart — `y` before the
 * accusative and dative, `n` before the genitive.
 */

/** The cases Turkish marks with a suffix. */
export type TrCase = "accusative" | "dative" | "inessive" | "elative" | "genitive" | "instrumental";

/** Whether the word softens its final consonant before a vowel. */
export interface TrStemFlags {
  /** `false` overrides the productive rule: `top` → `topu`, not *tobu. */
  softens?: boolean;
  /** Irregular buffer, as in `su` → `suyun` where `n` would be expected. */
  bufferY?: boolean;
  /**
   * The word already carries a third-person possessive suffix, as the head
   * of a compound does: `göbek dansı`, `cep telefonu`. Case suffixes then
   * need an `-n-` between them and the possessive — `dansına`, not
   * *dansıya.
   */
  possessed?: boolean;
}

/** The stem a vowel-initial suffix attaches to. */
function vowelStem(word: string, flags: TrStemFlags | undefined): string {
  if (!canSoften(word)) return word;
  return flags?.softens === false ? word : soften(word);
}

/** Build the plural: `-lar` or `-ler`. */
export function pluralForm(word: string): string {
  return `${word}l${lowVowel(word)}r`;
}

/**
 * Attach a case suffix to a word (which may already be a plural).
 */
export function applyCase(word: string, trCase: TrCase, flags?: TrStemFlags): string {
  const high = highVowel(word);
  const low = lowVowel(word);
  const vowelFinal = endsInVowel(word);

  // A possessed head takes an -n- before every case suffix, and then
  // behaves as if it ended in a consonant.
  if (flags?.possessed) {
    switch (trCase) {
      case "accusative":
        return `${word}n${high}`;
      case "dative":
        return `${word}n${low}`;
      case "genitive":
        return `${word}n${high}n`;
      case "inessive":
        return `${word}nd${low}`;
      case "elative":
        return `${word}nd${low}n`;
      case "instrumental":
        return `${word}yl${low}`;
    }
  }

  switch (trCase) {
    case "accusative": {
      // A buffer y keeps the two vowels apart: araba → arabayı.
      if (vowelFinal) return `${word}y${high}`;
      return vowelStem(word, flags) + high;
    }
    case "dative": {
      if (vowelFinal) return `${word}y${low}`;
      return vowelStem(word, flags) + low;
    }
    case "genitive": {
      if (vowelFinal) return `${word}${flags?.bufferY ? "y" : "n"}${high}n`;
      return `${vowelStem(word, flags) + high}n`;
    }
    // The locative and ablative start with a consonant, so the stem never
    // softens — but the consonant itself devoices after p, ç, t, k and the
    // rest: kitapta, evde.
    case "inessive":
      return word + (devoices(word) ? "t" : "d") + low;
    case "elative":
      return `${word + (devoices(word) ? "t" : "d") + low}n`;
    case "instrumental":
      return vowelFinal ? `${word}yl${low}` : `${word}l${low}`;
  }
}

/** Inflect a Turkish noun: plural and/or case. */
export function inflectNoun(
  word: string,
  plural: boolean,
  trCase: TrCase | undefined,
  flags?: TrStemFlags,
): string {
  if (flags?.possessed) {
    // The plural sits inside the possessive: göbek dansı → göbek dansları.
    const base = plural ? `${word.slice(0, -1)}l${lowVowel(word)}r${highVowel(word)}` : word;
    return trCase ? applyCase(base, trCase, flags) : base;
  }
  // The plural suffix is itself vowel-initial, so it triggers softening:
  // kitap → kitaplar keeps the p (the suffix starts with l), but the case
  // then harmonizes with the plural's own vowel.
  const base = plural ? pluralForm(word) : word;
  if (!trCase) return base;
  // Only the bare stem can soften; a plural ends in -r.
  return applyCase(base, trCase, plural ? undefined : flags);
}
