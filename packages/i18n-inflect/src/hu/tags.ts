import type { GrammaticalCase } from "../core/features.js";

/**
 * Mapping between the core feature model and UniMorph-style tag bundles.
 * Tags serve as lexicon keys and as `FallbackRequest.tag` for the neural
 * module — the exact strings must stay in sync with the data pipeline.
 */

/** Cases the Hungarian pack inflects in v1, with their UniMorph tags. */
export const HU_CASE_TAGS = {
  accusative: "ACC",
  dative: "DAT",
  genitive: "GEN",
  instrumental: "INS",
  translative: "TRANS",
  causalFinal: "PRP",
  terminative: "TERM",
  essiveFormal: "FRML",
  inessive: "IN+ESS",
  elative: "IN+ABL",
  illative: "IN+ALL",
  superessive: "ON+ESS",
  delative: "ON+ABL",
  sublative: "ON+ALL",
  adessive: "AT+ESS",
  ablative: "AT+ABL",
  allative: "AT+ALL",
} as const satisfies Partial<Record<GrammaticalCase, string>>;

/** A case the Hungarian pack understands. */
export type HuCase = keyof typeof HU_CASE_TAGS;

/** True when the case has a Hungarian suffix mapping. */
export function isHuCase(c: GrammaticalCase): c is HuCase {
  return c in HU_CASE_TAGS;
}

/** UniMorph tags for the possessive paradigm, by person and possessor number. */
export const HU_POSSESSOR_TAGS = {
  first: { singular: "PSS1S", plural: "PSS1P" },
  second: { singular: "PSS2S", plural: "PSS2P" },
  third: { singular: "PSS3S", plural: "PSS3P" },
} as const;

/** Build the tag for a possessive form: `"N;PSS3S;SG"`. */
export function possessiveTag(
  person: keyof typeof HU_POSSESSOR_TAGS,
  possessorPlural: boolean,
  possessedPlural: boolean,
): string {
  const owner = HU_POSSESSOR_TAGS[person][possessorPlural ? "plural" : "singular"];
  return `N;${owner};${possessedPlural ? "PL" : "SG"}`;
}

/** Build the UniMorph tag for a noun form: `nounTag("accusative", false)` → `"N;ACC;SG"`. */
export function nounTag(huCase: HuCase | undefined, plural: boolean): string {
  const caseTag = huCase ? HU_CASE_TAGS[huCase] : "NOM";
  return `N;${caseTag};${plural ? "PL" : "SG"}`;
}
