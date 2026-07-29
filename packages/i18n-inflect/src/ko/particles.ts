import type { FinalSound } from "./hangul.js";

/**
 * Korean case particles with their phonological alternations.
 *
 * The particle attaches to the *whole* noun phrase, chosen by the final
 * sound of its last syllable. When the final sound is undecidable (Latin
 * text), the conventional paired notation is used: "Chrome을(를)".
 */

/** Grammatical roles the Korean pack maps from `case:`. */
export type KoRole =
  | "nominative"
  | "accusative"
  | "topic"
  | "instrumental"
  | "comitative"
  | "genitive";

interface ParticleForms {
  /** After a batchim (closed syllable). */
  closed: string;
  /** After an open syllable. */
  open: string;
  /** After ㄹ — only differs for the instrumental (서울로). */
  rieul?: string;
  /** Paired notation for undecidable finals. */
  paired: string;
}

const PARTICLES: Record<KoRole, ParticleForms> = {
  nominative: { closed: "이", open: "가", paired: "이(가)" },
  accusative: { closed: "을", open: "를", paired: "을(를)" },
  topic: { closed: "은", open: "는", paired: "은(는)" },
  instrumental: { closed: "으로", open: "로", rieul: "로", paired: "(으)로" },
  comitative: { closed: "과", open: "와", paired: "과(와)" },
  genitive: { closed: "의", open: "의", paired: "의" },
};

/** Select the particle for a role given the phrase-final sound. */
export function particleFor(role: KoRole, final: FinalSound | undefined): string {
  const forms = PARTICLES[role];
  if (final === undefined) return forms.paired;
  if (final.isRieul && forms.rieul !== undefined) return forms.rieul;
  return final.hasBatchim ? forms.closed : forms.open;
}

/** True when the core feature case maps to a Korean particle role. */
export function isKoRole(value: string): value is KoRole {
  return value in PARTICLES;
}
