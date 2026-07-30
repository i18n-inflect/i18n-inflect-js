import type { GrammaticalGender } from "../core/features.js";

/**
 * Portuguese noun gender and plural.
 *
 * Portuguese is the most regular of the Romance languages here: the ending
 * decides the gender nine times in ten, and the plural is a short list of
 * spelling rules. The two places it is genuinely hard are `-ão`, which has
 * three plurals with no way to tell them apart (`mão → mãos`,
 * `pão → pães`, `coração → corações`), and where the stress falls in a
 * word ending in `-il` or `-s`, which the spelling only sometimes marks.
 */

/** Endings that fix the gender whatever the noun means. */
const FEMININE_ENDINGS = /(ção|são|dade|tude|gem|ice|eza|ez|ite|agem|triz|ude)$/;
const MASCULINE_ENDINGS = /(ma|ema|oma|or|ismo|mento|ão|ete|il)$/;

/**
 * Guess a noun's gender from its ending.
 *
 * The suffix classes are decided; for the rest this returns the commonest
 * gender for the shape and the lexicon overrides it.
 */
export function guessGender(lemma: string): GrammaticalGender {
  if (FEMININE_ENDINGS.test(lemma)) return "feminine";
  // Greek -ma nouns are masculine against the -a rule: o problema, o tema.
  if (MASCULINE_ENDINGS.test(lemma)) return "masculine";
  if (lemma.endsWith("a")) return "feminine";
  if (lemma.endsWith("o")) return "masculine";
  return "masculine";
}

/** Vowels that carry the acute in a plural like `papel` → `papéis`. */
const ACUTE: Record<string, string> = { a: "á", e: "é", o: "ó" };

/**
 * Build a noun's plural.
 *
 * `-ão` is the one class the rules cannot resolve: `-ões` is by far the
 * commonest, so that is what this produces, and the lexicon carries the
 * `-ãos` and `-ães` words.
 */
export function pluralize(lemma: string): string {
  if (lemma.endsWith("ão")) return `${lemma.slice(0, -2)}ões`;

  // -l words vocalize the l: animal → animais, papel → papéis.
  if (lemma.endsWith("l")) {
    const stem = lemma.slice(0, -1);
    const vowel = stem.at(-1) as string;
    if (vowel === "i") {
      // Stressed -il gives -is (fuzil → fuzis); an accent marks the
      // unstressed kind, which gives -eis (fóssil → fósseis).
      return /[áéíóúâêô]/.test(stem) ? `${stem.slice(0, -1)}eis` : `${stem}s`;
    }
    if (vowel === "u") return `${stem}is`;
    const accented = ACUTE[vowel];
    return accented === undefined ? `${stem}is` : `${stem.slice(0, -1)}${accented}is`;
  }

  // -m becomes -ns: homem → homens, jardim → jardins.
  if (lemma.endsWith("m")) return `${lemma.slice(0, -1)}ns`;

  // -r, -z and stressed -s take -es: mar → mares, luz → luzes, país → países.
  if (/[rz]$/.test(lemma)) return `${lemma}es`;
  if (lemma.endsWith("s")) {
    // Stress on the last syllable means the word takes -es (país → países);
    // anywhere else and the plural is identical (o lápis, os lápis). The
    // accent has to be *in* that syllable, so no vowel may follow it.
    if (/[áéíóúâêô][^aeiouáéíóúâêôãõ]{0,2}s$/.test(lemma)) return `${removeAccent(lemma)}es`;
    return lemma;
  }
  if (lemma.endsWith("x")) return lemma;
  if (lemma.endsWith("n")) return `${lemma}s`;

  return `${lemma}s`;
}

const PLAIN: Record<string, string> = {
  á: "a",
  é: "e",
  í: "i",
  ó: "o",
  ú: "u",
  â: "a",
  ê: "e",
  ô: "o",
};

/** `país` → `paises`: the accent is only needed while the word is short. */
function removeAccent(word: string): string {
  return word.replace(/[áéíóúâêô]/g, (ch) => PLAIN[ch] ?? ch);
}
