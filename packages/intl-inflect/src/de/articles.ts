import type { GrammaticalGender } from "../core/features.js";

/**
 * German article matrix and adjective-ending tables.
 *
 * Cases are limited to the German four (nominative, accusative, dative,
 * genitive); gender must be supplied by the caller for correct singular
 * forms — German noun gender is lexical and no heuristic is reliable.
 */

export type DeCase = "nominative" | "accusative" | "dative" | "genitive";
type GenderKey = "masculine" | "feminine" | "neuter";
type Slot = GenderKey | "plural";

function slotOf(gender: GrammaticalGender, plural: boolean): Slot {
  if (plural) return "plural";
  return gender === "common" ? "neuter" : gender;
}

const DEFINITE: Record<DeCase, Record<Slot, string>> = {
  nominative: { masculine: "der", feminine: "die", neuter: "das", plural: "die" },
  accusative: { masculine: "den", feminine: "die", neuter: "das", plural: "die" },
  dative: { masculine: "dem", feminine: "der", neuter: "dem", plural: "den" },
  genitive: { masculine: "des", feminine: "der", neuter: "des", plural: "der" },
};

/** Indefinite articles (singular only — the plural has none). */
const INDEFINITE: Record<DeCase, Record<GenderKey, string>> = {
  nominative: { masculine: "ein", feminine: "eine", neuter: "ein" },
  accusative: { masculine: "einen", feminine: "eine", neuter: "ein" },
  dative: { masculine: "einem", feminine: "einer", neuter: "einem" },
  genitive: { masculine: "eines", feminine: "einer", neuter: "eines" },
};

/** Look up an article form; indefinite plural returns `undefined` (dropped). */
export function articleForm(
  kind: "definite" | "indefinite",
  deCase: DeCase,
  gender: GrammaticalGender,
  plural: boolean,
): string | undefined {
  if (kind === "definite") return DEFINITE[deCase][slotOf(gender, plural)];
  if (plural) return undefined;
  return INDEFINITE[deCase][gender === "common" ? "neuter" : gender];
}

/** Adjective declension class, decided by what precedes the adjective. */
export type Declension = "weak" | "mixed" | "strong";

const WEAK: Record<DeCase, Record<Slot, string>> = {
  nominative: { masculine: "e", feminine: "e", neuter: "e", plural: "en" },
  accusative: { masculine: "en", feminine: "e", neuter: "e", plural: "en" },
  dative: { masculine: "en", feminine: "en", neuter: "en", plural: "en" },
  genitive: { masculine: "en", feminine: "en", neuter: "en", plural: "en" },
};

const MIXED: Record<DeCase, Record<Slot, string>> = {
  nominative: { masculine: "er", feminine: "e", neuter: "es", plural: "en" },
  accusative: { masculine: "en", feminine: "e", neuter: "es", plural: "en" },
  dative: { masculine: "en", feminine: "en", neuter: "en", plural: "en" },
  genitive: { masculine: "en", feminine: "en", neuter: "en", plural: "en" },
};

const STRONG: Record<DeCase, Record<Slot, string>> = {
  nominative: { masculine: "er", feminine: "e", neuter: "es", plural: "e" },
  accusative: { masculine: "en", feminine: "e", neuter: "es", plural: "e" },
  dative: { masculine: "em", feminine: "er", neuter: "em", plural: "en" },
  genitive: { masculine: "en", feminine: "er", neuter: "en", plural: "er" },
};

const TABLES: Record<Declension, Record<DeCase, Record<Slot, string>>> = {
  weak: WEAK,
  mixed: MIXED,
  strong: STRONG,
};

/** The adjective ending for a declension/case/gender/number slot. */
export function adjectiveEnding(
  declension: Declension,
  deCase: DeCase,
  gender: GrammaticalGender,
  plural: boolean,
): string {
  return TABLES[declension][deCase][slotOf(gender, plural)];
}

/** Adjective bases whose stem contracts before endings (teuer → teur-e). */
const CONTRACT: Record<string, string> = {
  dunkel: "dunkl",
  edel: "edl",
  hoch: "hoh",
  nobel: "nobl",
  sauer: "saur",
  teuer: "teur",
  übel: "übl",
};

/**
 * Adjective bases that *look* like they end in an inflection (-er/-el) but
 * keep their full stem: lecker → lecker-e, never "leck-e".
 */
const KEEP_FULL = new Set([
  "bitter",
  "finster",
  "lecker",
  "locker",
  "mager",
  "munter",
  "sauber",
  "tapfer",
]);

/**
 * Reduce an adjective token to its stem: contraction table first (bare
 * "teuer"), protected -er/-el bases next ("lecker"), then strip an existing
 * ending (-e, -em, -en, -er, -es).
 */
export function adjectiveStem(token: string): string {
  const lower = token.toLowerCase();
  const contracted = CONTRACT[lower];
  if (contracted !== undefined) return contracted;
  if (KEEP_FULL.has(lower)) return token;
  for (const ending of ["em", "en", "er", "es", "e"]) {
    if (lower.endsWith(ending) && token.length - ending.length >= 3) {
      return token.slice(0, token.length - ending.length);
    }
  }
  return token;
}
