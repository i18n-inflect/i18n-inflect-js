import { dropFleetingE, isSoft, isVelar, openVowel, palatalize, yOrI } from "./phonology.js";

/**
 * Polish noun declension.
 *
 * Seven cases in two numbers is fourteen cells, but they are not fourteen
 * independent facts: the dative, instrumental and locative plural are
 * `-om`, `-ami`, `-ach` for every noun in the language, and the vocative
 * repeats the locative or the nominative. What is genuinely per-word is a
 * handful of choices — whether the masculine genitive is `-a` or `-u`,
 * whether the accusative copies the genitive, how the nominative plural is
 * formed — and those are what the generated lexicon stores.
 */

/** The cases Polish marks. */
export type PlCase =
  | "nominative"
  | "genitive"
  | "dative"
  | "accusative"
  | "instrumental"
  | "locative"
  | "vocative";

/**
 * The four declension patterns, named for what the nominative singular
 * looks like: `kobieta`, `okno`, `kot`, `noc`.
 */
export type PlClass = "feminine-a" | "neuter" | "masculine" | "feminine-consonant";

/** What the lexicon can say about one noun. */
export interface PlStemFlags {
  /** When the ending does not give the class away — `noc` is not a `kot`. */
  class?: PlClass;
  /** The oblique stem, when the rules cannot derive it from the nominative. */
  stem?: string;
  /** Masculine genitive singular: `-a` (kota) or `-u` (domu). */
  genSg?: string;
  /** Dative singular: `-owi` for most, `-u` for a short closed list. */
  datSg?: string;
  /** Locative singular, when neither `-e` nor `-u` follows from the stem. */
  locSg?: string;
  /** Nominative plural: `-y`, `-i`, `-e`, `-owie`, `-a`. */
  nomPl?: string;
  /** Genitive plural: `-ów`, `-y`, `-i`, or nothing at all. */
  genPl?: string;
  /** Animate: the accusative singular copies the genitive — `widzę kota`. */
  animate?: boolean;
  /** Personal (masculine): the accusative plural copies the genitive too. */
  personal?: boolean;
  /** Cells nothing shorter explains, keyed `case.number`. */
  forms?: Readonly<Record<string, string>>;
}

/** Soft consonants written with a following `i` before a vowel. */
const SOFT_BEFORE_VOWEL: [string, string][] = [
  ["dź", "dzi"],
  ["ń", "ni"],
  ["ś", "si"],
  ["ć", "ci"],
  ["ź", "zi"],
];

/** `koń` + `-em` is written `koniem`: the softness moves onto the vowel. */
function expandSoft(stem: string): string {
  for (const [soft, spelled] of SOFT_BEFORE_VOWEL) {
    if (stem.endsWith(soft)) return stem.slice(0, -soft.length) + spelled;
  }
  return stem;
}

/** Join a stem and an ending, with the spelling changes the join forces. */
function attach(stem: string, ending: string): string {
  if (ending === "") return stem;
  const first = ending[0] as string;
  if ("aeęąouó".includes(first)) {
    let base = expandSoft(stem);
    // A velar cannot be followed by a bare `e`: rok → rokiem, róg → rogiem.
    if (first === "e" && isVelar(base)) base += "i";
    return base + ending;
  }
  if (first === "i") {
    // A soft consonant absorbs the `i` it is written with: `koń` + `-i` is
    // `koni`, not *końi, and `ziemi` + `-i` is still `ziemi`.
    const base = expandSoft(stem);
    return base.endsWith("i") ? base + ending.slice(1) : base + ending;
  }
  return stem + ending;
}

/**
 * Insert the `e` that a bare genitive plural needs to be pronounceable:
 * `książk-` → `książek`, `okn-` → `okien`, `matk-` → `matek`.
 */
const TAKES_FLEETING_E = new Set([..."kcnńwł"]);

function insertFleetingE(stem: string): string {
  if (stem.length < 2) return stem;
  const last = stem.at(-1) as string;
  const before = stem.at(-2) as string;
  if ("aeiouyąęó".includes(before) || !TAKES_FLEETING_E.has(last)) return stem;
  // The `e` goes in as an ending would, so a velar in front of it picks up
  // its `i`: `okn-` → `okien`, `książk-` → `książek`.
  return attach(stem.slice(0, -1), "e") + last;
}

/** Guess the declension class from the nominative singular. */
export function guessClass(lemma: string): PlClass {
  if (lemma.endsWith("a")) return "feminine-a";
  if (/[oeę]$/.test(lemma) || lemma.endsWith("um")) return "neuter";
  return "masculine";
}

/** The stem the oblique cases are built on. */
function obliqueStem(lemma: string, plClass: PlClass, flags: PlStemFlags | undefined): string {
  if (flags?.stem !== undefined) return flags.stem;
  if (plClass === "feminine-a") return lemma.slice(0, -1);
  if (plClass === "neuter") return lemma.endsWith("um") ? lemma.slice(0, -2) : lemma.slice(0, -1);
  // A masculine or consonant-final feminine loses its fleeting e and opens
  // its last vowel: pies → ps-, stół → stoł-.
  return openVowel(dropFleetingE(lemma));
}

/**
 * The `-y` / `-i` a feminine stem takes in the genitive singular and the
 * nominative plural, which are the same form.
 */
function feminineI(stem: string): string {
  return stem.endsWith("i") ? "" : yOrI(stem);
}

function declineFeminineA(
  lemma: string,
  stem: string,
  plCase: PlCase,
  plural: boolean,
  flags: PlStemFlags | undefined,
): string {
  // The dative and locative palatalize all the way through the velars:
  // noga → nodze, ręka → ręce, książka → książce.
  const soft = isSoft(stem);
  const dative = soft ? attach(stem, feminineI(stem)) : `${palatalize(stem, true)}e`;

  if (!plural) {
    switch (plCase) {
      case "nominative":
        return lemma;
      case "genitive":
        return attach(stem, feminineI(stem));
      case "dative":
      case "locative":
        return dative;
      case "accusative":
        return attach(stem, "ę");
      case "instrumental":
        return attach(stem, "ą");
      case "vocative":
        return attach(stem, "o");
    }
  }
  // A soft stem takes `-e` in the plural and `-i` in the genitive plural:
  // `abdykacja` → `abdykacje`, `abdykacji`; `ziemia` → `ziemie`, `ziemi`.
  const nomPl = flags?.nomPl ?? (soft ? "e" : feminineI(stem));
  switch (plCase) {
    case "nominative":
    case "accusative":
    case "vocative":
      return attach(stem, nomPl);
    case "genitive":
      if (flags?.genPl !== undefined) return attach(stem, flags.genPl);
      if (!soft) return insertFleetingE(stem);
      // `-ia` is two different endings. After a native soft consonant the
      // `i` is the softness and nothing more (`bania` → `bani`); in a Greek
      // or Latin loan it is a vowel of its own, and survives into the
      // genitive (`akademia` → `akademii`).
      if (stem.endsWith("i") && !/[nzśćźl]i$/.test(stem)) return `${stem}i`;
      return attach(stem, "i");
    case "dative":
      return attach(stem, "om");
    case "instrumental":
      return attach(stem, "ami");
    case "locative":
      return attach(stem, "ach");
  }
}

function declineNeuter(
  lemma: string,
  stem: string,
  plCase: PlCase,
  plural: boolean,
  flags: PlStemFlags | undefined,
): string {
  if (!plural) {
    // `-um` nouns do not decline in the singular at all: muzeum, muzeum…
    if (lemma.endsWith("um")) return lemma;
    switch (plCase) {
      case "nominative":
      case "accusative":
      case "vocative":
        return lemma;
      case "genitive":
        return attach(stem, "a");
      case "dative":
        return attach(stem, "u");
      case "instrumental":
        return attach(stem, "em");
      case "locative":
        return flags?.locSg !== undefined
          ? attach(stem, flags.locSg)
          : isVelar(stem) || isSoft(stem)
            ? attach(stem, "u")
            : `${palatalize(stem)}e`;
    }
  }
  switch (plCase) {
    case "nominative":
    case "accusative":
    case "vocative":
      return attach(stem, flags?.nomPl ?? "a");
    case "genitive":
      if (flags?.genPl !== undefined) return attach(stem, flags.genPl);
      // A `-um` noun is indeclinable in the singular but perfectly Polish
      // in the plural: `akwarium`, `akwaria`, `akwariów`.
      return lemma.endsWith("um") ? attach(stem, "ów") : insertFleetingE(stem);
    case "dative":
      return attach(stem, "om");
    case "instrumental":
      return attach(stem, "ami");
    case "locative":
      return attach(stem, "ach");
  }
}

function declineMasculine(
  lemma: string,
  stem: string,
  plCase: PlCase,
  plural: boolean,
  flags: PlStemFlags | undefined,
): string {
  // Animacy decides the genitive as well as the accusative: a `kot` has a
  // `kota`, a `dom` has a `domu`.
  const genSg = flags?.genSg ?? (flags?.animate || flags?.personal ? "a" : "u");
  const locative =
    flags?.locSg !== undefined
      ? attach(stem, flags.locSg)
      : isVelar(stem) || isSoft(stem)
        ? attach(stem, "u")
        : `${palatalize(stem)}e`;

  if (!plural) {
    switch (plCase) {
      case "nominative":
        return lemma;
      case "genitive":
        return attach(stem, genSg);
      case "dative":
        return attach(stem, flags?.datSg ?? "owi");
      case "accusative":
        return flags?.animate || flags?.personal ? attach(stem, genSg) : lemma;
      case "instrumental":
        return attach(stem, "em");
      case "locative":
      case "vocative":
        return locative;
    }
  }

  // `-anin` names a member of a group, and the `-in` is singular only:
  // `Amerykanin`, `Amerykanie`, `Amerykanów`.
  if (lemma.endsWith("anin")) {
    const group = lemma.slice(0, -2);
    switch (plCase) {
      case "nominative":
      case "vocative":
        return attach(group, flags?.nomPl ?? "ie");
      case "genitive":
      case "accusative":
        return attach(group, flags?.genPl ?? "");
      case "dative":
        return attach(group, "om");
      case "instrumental":
        return attach(group, "ami");
      case "locative":
        return attach(group, "ach");
    }
  }

  // Men take a palatalized `-i`: `abiturient` → `abiturienci`, `Polak` →
  // `Polacy`. Everything else takes `-y`/`-i`, or `-e` after a soft stem.
  const nomPl = flags?.nomPl ?? (flags?.personal ? undefined : isSoft(stem) ? "e" : yOrI(stem));
  const personalPl = `${palatalize(stem, true)}${yOrI(palatalize(stem, true))}`;
  const genPl = flags?.genPl ?? (isSoft(stem) ? yOrI(stem) : "ów");
  switch (plCase) {
    case "nominative":
    case "vocative":
      return nomPl === undefined ? personalPl : attach(stem, nomPl);
    case "accusative":
      return flags?.personal
        ? attach(stem, genPl)
        : nomPl === undefined
          ? personalPl
          : attach(stem, nomPl);
    case "genitive":
      return attach(stem, genPl);
    case "dative":
      return attach(stem, "om");
    case "instrumental":
      return attach(stem, "ami");
    case "locative":
      return attach(stem, "ach");
  }
}

function declineFeminineConsonant(
  lemma: string,
  stem: string,
  plCase: PlCase,
  plural: boolean,
  flags: PlStemFlags | undefined,
): string {
  const oblique = attach(stem, yOrI(stem));
  if (!plural) {
    switch (plCase) {
      case "nominative":
      case "accusative":
        return lemma;
      case "instrumental":
        return attach(stem, "ą");
      case "genitive":
      case "dative":
      case "locative":
      case "vocative":
        return oblique;
    }
  }
  switch (plCase) {
    case "nominative":
    case "accusative":
    case "vocative":
      return attach(stem, flags?.nomPl ?? "e");
    case "genitive":
      return attach(stem, flags?.genPl ?? yOrI(stem));
    case "dative":
      return attach(stem, "om");
    case "instrumental":
      return attach(stem, "ami");
    case "locative":
      return attach(stem, "ach");
  }
}

/** Decline a Polish noun into one cell of its paradigm. */
export function declineNoun(
  lemma: string,
  plCase: PlCase,
  plural: boolean,
  flags?: PlStemFlags,
): string {
  const override = flags?.forms?.[`${plCase}.${plural ? "pl" : "sg"}`];
  if (override !== undefined) return override;

  const plClass = flags?.class ?? guessClass(lemma);
  const stem = obliqueStem(lemma, plClass, flags);
  switch (plClass) {
    case "feminine-a":
      return declineFeminineA(lemma, stem, plCase, plural, flags);
    case "neuter":
      return declineNeuter(lemma, stem, plCase, plural, flags);
    case "feminine-consonant":
      return declineFeminineConsonant(lemma, stem, plCase, plural, flags);
    case "masculine":
      return declineMasculine(lemma, stem, plCase, plural, flags);
  }
}
