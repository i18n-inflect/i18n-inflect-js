/**
 * Russian noun declension.
 *
 * Russian endings come in pairs — `-а`/`-я`, `-у`/`-ю`, `-ом`/`-ем`,
 * `-ы`/`-и` — and which of each pair a noun takes is decided once, by
 * whether its stem is hard or soft. That single choice runs through the
 * whole paradigm, so the tables below are written once and read twice.
 *
 * On top of that sit two spelling rules that have nothing to do with
 * grammar and everything to do with the alphabet: `ы` may not be written
 * after `г к х ж ч ш щ`, and `о` may not be written after a husher unless
 * it is stressed. The first is mechanical. The second depends on stress,
 * which the spelling does not record — so it is one of the things the
 * generated lexicon has to carry.
 */

/** The cases Russian marks. */
export type RuCase =
  | "nominative"
  | "genitive"
  | "dative"
  | "accusative"
  | "instrumental"
  | "prepositional";

/** The declension patterns, named for the nominative singular. */
export type RuClass = "masculine" | "feminine-a" | "feminine-soft" | "neuter";

/** What the lexicon can say about one noun. */
export interface RuStemFlags {
  /** `-ь` is masculine as often as it is feminine, and only a word knows. */
  class?: RuClass;
  /** The oblique stem, when a vowel drops: `отец` → `отц-`. */
  stem?: string;
  /** The stem takes soft endings although its last letter looks hard. */
  soft?: boolean;
  genSg?: string;
  datSg?: string;
  insSg?: string;
  prepSg?: string;
  nomPl?: string;
  genPl?: string;
  /** Animate: the accusative copies the genitive, in both numbers. */
  animate?: boolean;
  /** Cells nothing shorter explains, keyed `case.number`. */
  forms?: Readonly<Record<string, string>>;
}

/** Consonants after which `ы` is written `и`. */
const NO_Y = /[гкхжчшщ]$/;
/** Consonants after which unstressed `о` is written `е`. */
const HUSHER = /[жчшщц]$/;

const VOWELS = "аеёиоуыэюя";

/** Pick the hard or the soft member of an ending pair. */
function pick(soft: boolean, hard: string, softForm: string): string {
  return soft ? softForm : hard;
}

/**
 * Apply the spelling rules to an ending that has already been chosen.
 *
 * These are not grammar: `книги` has the same ending as `комнаты`, written
 * differently because Russian does not write `ы` after `г`.
 */
function spell(stem: string, ending: string): string {
  let adjusted = ending;
  if (adjusted.startsWith("ы") && NO_Y.test(stem)) adjusted = `и${adjusted.slice(1)}`;
  if (adjusted.startsWith("о") && HUSHER.test(stem)) adjusted = `е${adjusted.slice(1)}`;
  return stem + adjusted;
}

/** Guess the declension class from the nominative singular. */
export function guessClass(lemma: string): RuClass {
  if (/[ая]$/.test(lemma)) return "feminine-a";
  if (/[оеё]$/.test(lemma)) return "neuter";
  // `-ь` is a coin toss between `конь` and `ночь`; the feminine is commoner
  // in the dictionary, and the lexicon corrects the rest.
  if (lemma.endsWith("ь")) return "feminine-soft";
  return "masculine";
}

/** True when the stem takes the soft series of endings. */
function isSoft(lemma: string, plClass: RuClass, flags: RuStemFlags | undefined): boolean {
  if (flags?.soft !== undefined) return flags.soft;
  if (plClass === "feminine-soft") return true;
  if (plClass === "feminine-a") return lemma.endsWith("я");
  if (plClass === "neuter") return /[её]$/.test(lemma);
  return /[ьй]$/.test(lemma);
}

/**
 * The `-ец` suffix keeps its vowel only in the bare nominative: `немец` is
 * `немца`, `борец` is `борца`, `отец` is `отца`. It is one of the most
 * productive endings in the language, so this one rule accounts for
 * thousands of forms.
 */
function dropFleetingE(lemma: string): string {
  if (!lemma.endsWith("ец") || lemma.length < 4) return lemma;
  const before = lemma.at(-3) as string;
  // After a vowel the `й` that the `е` was hiding comes back:
  // `австралиец` → `австралийц-`.
  if (VOWELS.includes(before)) return `${lemma.slice(0, -2)}йц`;
  // An `л` in front softens: `палец` → `пальц-`, `владелец` → `владельц-`.
  if (before === "л") return `${lemma.slice(0, -2)}ьц`;
  return `${lemma.slice(0, -2)}ц`;
}

/** The stem the endings attach to. */
function obliqueStem(lemma: string, plClass: RuClass, flags: RuStemFlags | undefined): string {
  if (flags?.stem !== undefined) return flags.stem;
  if (plClass === "masculine") {
    return /[ьй]$/.test(lemma) ? lemma.slice(0, -1) : dropFleetingE(lemma);
  }
  return lemma.slice(0, -1);
}

/**
 * `-ия`, `-ие` and `-ий` decline like anything else except in three cells,
 * where the `и` of the stem swallows the ending: `гистология` is
 * `гистологии` in the dative and the prepositional, not *гистологие.
 */
function iStem(stem: string): boolean {
  return stem.endsWith("и");
}

/**
 * The bare genitive plural of a feminine or neuter noun, with the vowel
 * that a final consonant cluster needs: `окн-` → `окон`, `сестр-` →
 * `сестёр`.
 */
function bareGenitivePlural(stem: string, soft: boolean): string {
  if (iStem(stem)) return `${stem}й`;
  const last = stem.at(-1) as string;
  const before = stem.at(-2);
  if (before !== undefined && !VOWELS.includes(before) && !VOWELS.includes(last)) {
    // The inserted vowel is `е` after a soft or hushing consonant and `о`
    // otherwise — the same choice the endings make everywhere else.
    const filler = soft || HUSHER.test(stem.slice(0, -1)) ? "е" : "о";
    return stem.slice(0, -1) + filler + last;
  }
  return stem;
}

function declineMasculine(
  lemma: string,
  stem: string,
  soft: boolean,
  ruCase: RuCase,
  plural: boolean,
  flags: RuStemFlags | undefined,
): string {
  const genSg = flags?.genSg ?? pick(soft, "а", "я");
  const nomPl = flags?.nomPl ?? pick(soft, "ы", "и");
  // `-ь` takes `-ей`, `-й` takes `-ев`, a husher takes `-ей` (`врач` →
  // `врачей`), and a plain consonant takes `-ов`.
  const genPl =
    flags?.genPl ??
    (soft ? (lemma.endsWith("ь") ? "ей" : "ев") : /[жчшщ]$/.test(stem) ? "ей" : "ов");

  if (!plural) {
    switch (ruCase) {
      case "nominative":
        return lemma;
      case "genitive":
        return spell(stem, genSg);
      case "dative":
        return spell(stem, flags?.datSg ?? pick(soft, "у", "ю"));
      case "accusative":
        return flags?.animate ? spell(stem, genSg) : lemma;
      case "instrumental":
        return spell(stem, flags?.insSg ?? pick(soft, "ом", "ем"));
      case "prepositional":
        return spell(stem, flags?.prepSg ?? (iStem(stem) ? "и" : "е"));
    }
  }
  switch (ruCase) {
    case "nominative":
      return spell(stem, nomPl);
    case "genitive":
      return spell(stem, genPl);
    case "accusative":
      return spell(stem, flags?.animate ? genPl : nomPl);
    case "dative":
      return spell(stem, pick(soft, "ам", "ям"));
    case "instrumental":
      return spell(stem, pick(soft, "ами", "ями"));
    case "prepositional":
      return spell(stem, pick(soft, "ах", "ях"));
  }
}

function declineFeminineA(
  lemma: string,
  stem: string,
  soft: boolean,
  ruCase: RuCase,
  plural: boolean,
  flags: RuStemFlags | undefined,
): string {
  const nomPl = flags?.nomPl ?? pick(soft, "ы", "и");
  const dative = flags?.datSg ?? (iStem(stem) ? "и" : "е");

  if (!plural) {
    switch (ruCase) {
      case "nominative":
        return lemma;
      case "genitive":
        return spell(stem, flags?.genSg ?? pick(soft, "ы", "и"));
      case "dative":
        return spell(stem, dative);
      case "accusative":
        return spell(stem, pick(soft, "у", "ю"));
      case "instrumental":
        return spell(stem, flags?.insSg ?? pick(soft, "ой", "ей"));
      case "prepositional":
        return spell(stem, flags?.prepSg ?? dative);
    }
  }
  switch (ruCase) {
    case "nominative":
      return spell(stem, nomPl);
    case "genitive":
      return flags?.genPl === undefined ? bareGenitivePlural(stem, soft) : spell(stem, flags.genPl);
    case "accusative":
      return flags?.animate
        ? flags.genPl === undefined
          ? bareGenitivePlural(stem, soft)
          : spell(stem, flags.genPl)
        : spell(stem, nomPl);
    case "dative":
      return spell(stem, pick(soft, "ам", "ям"));
    case "instrumental":
      return spell(stem, pick(soft, "ами", "ями"));
    case "prepositional":
      return spell(stem, pick(soft, "ах", "ях"));
  }
}

function declineFeminineSoft(
  lemma: string,
  stem: string,
  ruCase: RuCase,
  plural: boolean,
  flags: RuStemFlags | undefined,
): string {
  if (!plural) {
    switch (ruCase) {
      case "nominative":
      case "accusative":
        return lemma;
      case "instrumental":
        return spell(stem, flags?.insSg ?? "ью");
      case "genitive":
      case "dative":
      case "prepositional":
        return spell(stem, "и");
    }
  }
  const nomPl = flags?.nomPl ?? "и";
  switch (ruCase) {
    case "nominative":
      return spell(stem, nomPl);
    case "accusative":
      return spell(stem, flags?.animate ? (flags.genPl ?? "ей") : nomPl);
    case "genitive":
      return spell(stem, flags?.genPl ?? "ей");
    case "dative":
      return spell(stem, "ям");
    case "instrumental":
      return spell(stem, "ями");
    case "prepositional":
      return spell(stem, "ях");
  }
}

function declineNeuter(
  lemma: string,
  stem: string,
  soft: boolean,
  ruCase: RuCase,
  plural: boolean,
  flags: RuStemFlags | undefined,
): string {
  const nomPl = flags?.nomPl ?? pick(soft, "а", "я");
  if (!plural) {
    switch (ruCase) {
      case "nominative":
      case "accusative":
        return lemma;
      case "genitive":
        return spell(stem, flags?.genSg ?? pick(soft, "а", "я"));
      case "dative":
        return spell(stem, flags?.datSg ?? pick(soft, "у", "ю"));
      case "instrumental":
        return spell(stem, flags?.insSg ?? pick(soft, "ом", "ем"));
      case "prepositional":
        return spell(stem, flags?.prepSg ?? (iStem(stem) ? "и" : "е"));
    }
  }
  switch (ruCase) {
    case "nominative":
    case "accusative":
      return spell(stem, nomPl);
    case "genitive":
      return flags?.genPl === undefined ? bareGenitivePlural(stem, soft) : spell(stem, flags.genPl);
    case "dative":
      return spell(stem, pick(soft, "ам", "ям"));
    case "instrumental":
      return spell(stem, pick(soft, "ами", "ями"));
    case "prepositional":
      return spell(stem, pick(soft, "ах", "ях"));
  }
}

/** Decline a Russian noun into one cell of its paradigm. */
export function declineNoun(
  lemma: string,
  ruCase: RuCase,
  plural: boolean,
  flags?: RuStemFlags,
): string {
  const override = flags?.forms?.[`${ruCase}.${plural ? "pl" : "sg"}`];
  if (override !== undefined) return override;

  const ruClass = flags?.class ?? guessClass(lemma);
  const stem = obliqueStem(lemma, ruClass, flags);
  const soft = isSoft(lemma, ruClass, flags);
  switch (ruClass) {
    case "masculine":
      return declineMasculine(lemma, stem, soft, ruCase, plural, flags);
    case "feminine-a":
      return declineFeminineA(lemma, stem, soft, ruCase, plural, flags);
    case "feminine-soft":
      return declineFeminineSoft(lemma, stem, ruCase, plural, flags);
    case "neuter":
      return declineNeuter(lemma, stem, soft, ruCase, plural, flags);
  }
}
