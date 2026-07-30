import type { GrammaticalGender } from "../core/features.js";

/**
 * German noun gender and plural.
 *
 * German gender is famously arbitrary — *der* Löffel, *die* Gabel, *das*
 * Messer for three things on the same table — but it is not *entirely*
 * arbitrary, and what saves it is compounding. A German compound takes the
 * gender and the plural of its **last** element, and German compounds
 * freely: `Krankenhaus` is a `Haus`, `Übersetzungswörterbuch` is a `Buch`,
 * `Waffenstillstand` is a `Stand`. So the lexicon only has to know the few
 * thousand simplex nouns, and every compound built on one of them follows
 * for free — including compounds no dictionary lists.
 *
 * On top of that, derivational suffixes decide gender outright: everything
 * in `-ung`, `-heit` or `-keit` is feminine, everything in `-chen` or
 * `-lein` is neuter however masculine the thing it names (*das Mädchen*).
 *
 * The same split applies to the plural. `-ung` → `-ungen` is exceptionless,
 * while whether a bare stem takes `-e`, `-er`, `-en` or nothing — and
 * whether it umlauts — is lexical: `Hund → Hunde` but `Buch → Bücher`,
 * `Tag → Tage` but `Baum → Bäume`.
 */

/** Endings that fix the gender whatever the noun means. */
const FEMININE_ENDINGS =
  /(ung|heit|keit|schaft|ion|tät|ität|ik|ur|anz|enz|ie|ei|age|ade|üre|ette|ille|itis|sis)$/;
const NEUTER_ENDINGS = /(chen|lein|ment|tum|tel|nis|ma|il|eau)$/;
const MASCULINE_ENDINGS = /(ling|ismus|ist|ant|ent|eur|or|är|ich|ig|och|us)$/;

/** Latin `-um` is neuter (Datum, Zentrum) — but `-aum` is a German stem. */
const LATIN_UM = /(?<!a)um$/;

/**
 * The gender a derivational suffix imposes, if the noun has one.
 *
 * These are the exceptionless cases, and they outrank everything —
 * including a compound reading. `Abbildung` is *not* a kind of `Dung`
 * however convincingly it ends in one; `-ung` has already decided.
 */
export function decidedGender(lemma: string): GrammaticalGender | undefined {
  // -in derives a feminine agent noun (Lehrerin), but only from a longer
  // stem: Wein and Sinn are not agent nouns.
  if (lemma.length > 5 && lemma.endsWith("in") && !lemma.endsWith("ein")) return "feminine";
  if (FEMININE_ENDINGS.test(lemma)) return "feminine";
  if (NEUTER_ENDINGS.test(lemma) || LATIN_UM.test(lemma)) return "neuter";
  if (MASCULINE_ENDINGS.test(lemma)) return "masculine";
  return undefined;
}

/**
 * Guess a noun's gender from its ending.
 *
 * The suffix classes are decided; for the rest this returns the commonest
 * gender for the shape, and the lexicon overrides it.
 */
export function guessGender(lemma: string): GrammaticalGender {
  const decided = decidedGender(lemma);
  if (decided !== undefined) return decided;
  // Ge- … -e collectives are neuter: Gebäude, Gebirge, Gemälde.
  if (/^Ge.*e$/.test(lemma)) return "neuter";
  if (lemma.endsWith("e")) return "feminine";
  return "masculine";
}

/** Vowels that can carry an umlaut, and what they become. */
const UMLAUT: Record<string, string> = { a: "ä", o: "ö", u: "ü", A: "Ä", O: "Ö", U: "Ü" };

/**
 * Umlaut the plural stem: the *last* back vowel takes the diaeresis, and
 * `au` umlauts as a unit — `Haus` → `Häus-`, not *Hausä-.
 */
export function umlaut(stem: string): string {
  for (let i = stem.length - 1; i >= 0; i--) {
    const ch = stem[i] as string;
    const mutated = UMLAUT[ch];
    if (mutated === undefined) continue;
    // In `au` the a is the one that changes, so skip a u that follows an a.
    if (ch.toLowerCase() === "u" && stem[i - 1]?.toLowerCase() === "a") continue;
    return stem.slice(0, i) + mutated + stem.slice(i + 1);
  }
  return stem;
}

/**
 * Endings after which the plural adds nothing: Lehrer, Löffel, Wagen.
 *
 * The `e` has to be a real unstressed syllable, which it is not in `-ier`
 * — `Tier` and `Papier` take `-e` like any other stem.
 */
const NULL_PLURAL = /(chen|lein|(?<!i)er|el|en)$/;

/**
 * Build a noun's plural from its ending and gender.
 *
 * The productive part of the system is covered here; the umlauting classes
 * and the foreign paradigms come from the lexicon.
 */
export function decidedPlural(lemma: string, gender: GrammaticalGender): string | undefined {
  if (lemma.length > 5 && lemma.endsWith("in") && !lemma.endsWith("ein")) return `${lemma}nen`;
  if (/(ung|heit|keit|schaft|ion|tät|ität|ik|ur|anz|enz|ei)$/.test(lemma)) return `${lemma}en`;
  if (lemma.endsWith("ismus")) return `${lemma.slice(0, -2)}en`;
  if (lemma.endsWith("ling")) return `${lemma}e`;
  if (lemma.endsWith("nis")) return `${lemma}se`;
  if (/(chen|lein)$/.test(lemma)) return lemma;
  if (LATIN_UM.test(lemma)) return `${lemma.slice(0, -2)}en`;
  // Agent nouns in -or, -ent, -ant, -ist take the weak plural — but only
  // where they really are agent nouns: `das Parlament` is not, and takes
  // `-e` like the neuter stem it is.
  if (gender === "masculine" && /(or|ent|ant|ist)$/.test(lemma)) return `${lemma}en`;
  return undefined;
}

export function pluralize(lemma: string, gender: GrammaticalGender): string {
  const decided = decidedPlural(lemma, gender);
  if (decided !== undefined) return decided;

  // A final -e takes -n in every gender: Blume, Junge, Auge.
  if (lemma.endsWith("e")) return `${lemma}n`;
  // Another unstressed vowel marks a loanword, which takes -s: Auto, Sofa.
  if (/[aiouy]$/.test(lemma)) return `${lemma}s`;

  if (NULL_PLURAL.test(lemma)) {
    // Feminines in -er and -el are the exception: Schwester → Schwestern.
    return gender === "feminine" ? `${lemma}n` : lemma;
  }

  // A bare stem: feminines take -en, masculine and neuter take -e.
  return gender === "feminine" ? `${lemma}en` : `${lemma}e`;
}

/**
 * Decode a stored plural.
 *
 * Storing `Buch|uer` instead of `Buch|Bücher` is not just smaller: the code
 * is a *pattern*, so it applies to every compound ending in `Buch` too.
 * An optional `u` umlauts the stem, an optional `-n` shortens it by n
 * characters, and the rest is the suffix. A leading `=` means the form is
 * irregular enough to be stored verbatim.
 */
export function decodePlural(lemma: string, code: string): string {
  if (code.startsWith("=")) return code.slice(1);
  let rest = code;
  let stem = lemma;
  if (rest.startsWith("u")) {
    stem = umlaut(stem);
    rest = rest.slice(1);
  }
  if (rest.startsWith("-")) {
    stem = stem.slice(0, -Number(rest[1]));
    rest = rest.slice(2);
  }
  return stem + rest;
}

/**
 * The shortest prefix that still makes a compound worth believing in, and
 * the shortest final element. `Ei` would match half the dictionary as a
 * head, so a head has to be a real word's length.
 */
const MIN_PREFIX = 3;
const MIN_HEAD = 4;

/**
 * Find the lexicon entry for a compound's final element.
 *
 * Only *stored* heads are consulted, because a head the rules already
 * handle needs no lookup: the rules read the ending, and a compound ends
 * in its head. `Riesentier` and `Tier` get the same answer either way.
 */
export function compoundHeadKey(
  lemma: string,
  lexicon: ReadonlyMap<string, unknown>,
  blocked: ReadonlySet<string>,
): string | undefined {
  const lower = lemma.toLowerCase();
  // Longest head first: `Wörterbuch` is a `Buch`, and `Uch` is not a word.
  for (let i = MIN_PREFIX; i <= lower.length - MIN_HEAD; i++) {
    const key = lower.slice(i);
    if (!blocked.has(key) && lexicon.has(key)) return key;
  }
  return undefined;
}

function compoundHead<T>(
  lemma: string,
  lexicon: ReadonlyMap<string, T>,
  blocked: ReadonlySet<string>,
): T | undefined {
  const key = compoundHeadKey(lemma, lexicon, blocked);
  return key === undefined ? undefined : lexicon.get(key);
}

/** The three tables a German noun lookup needs. */
export interface DeLexicon {
  genders: ReadonlyMap<string, GrammaticalGender>;
  plurals: ReadonlyMap<string, string>;
  /**
   * Words that are real nouns but bad compound heads, measured against the
   * corpus: `Ufer` inside `Amokläufer`, `Dung` inside `Abbildung`. Taking
   * them as heads costs more than it earns.
   */
  blockedHeads: ReadonlySet<string>;
}

/**
 * A noun's gender: the lexicon first, then its final element's, then the
 * ending heuristic.
 */
export function resolveGender(lemma: string, lexicon: DeLexicon): GrammaticalGender {
  return (
    lexicon.genders.get(lemma.toLowerCase()) ??
    decidedGender(lemma) ??
    compoundHead(lemma, lexicon.genders, lexicon.blockedHeads) ??
    guessGender(lemma)
  );
}

/**
 * A noun's plural: the lexicon first, then its final element's pattern
 * applied to the whole compound, then the rules.
 *
 * Applying the head's pattern to the whole word is what makes umlaut work
 * on compounds: the umlaut lands on the last back vowel, which is in the
 * head — `Krankenhaus` → `Krankenhäuser`.
 */
export function resolvePlural(
  lemma: string,
  gender: GrammaticalGender,
  lexicon: DeLexicon,
): string {
  const exact = lexicon.plurals.get(lemma.toLowerCase());
  if (exact !== undefined) return decodePlural(lemma, exact);
  const decided = decidedPlural(lemma, gender);
  if (decided !== undefined) return decided;
  const head = compoundHead(lemma, lexicon.plurals, lexicon.blockedHeads);
  // A verbatim form belongs to the head alone and says nothing about a
  // compound built on it, so those do not transfer.
  if (head !== undefined && !head.startsWith("=")) return decodePlural(lemma, head);
  return pluralize(lemma, gender);
}
