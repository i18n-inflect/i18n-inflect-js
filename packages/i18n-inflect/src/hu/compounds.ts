import { harmonyOf } from "./phonology.js";
import type { StemFlags } from "./stems.js";

/**
 * Compound-aware stem resolution.
 *
 * Hungarian compounds inflect after their **final member**: `kávéház` takes
 * `ház`'s lowered linking vowel (kávéházat, not *kávéházt*), and `fénysugár`
 * takes `sugár`'s shortening stem (fénysugarat). Treating the compound as an
 * unknown word instead is the single largest source of error in the rule
 * engine, because compounding is unboundedly productive — no lexicon can
 * list the compounds themselves.
 *
 * So when a word is not in the lexicon, look for the longest known lemma it
 * ends with and inherit that lemma's behaviour, rebasing any alternate stem
 * onto the full word.
 */

/**
 * The head must be long enough that matching it is evidence of composition
 * rather than coincidence. Two-letter heads like `ér` would fire on
 * `pincér`, which is not a compound at all.
 */
const MIN_HEAD = 3;

/** The part before the head must be a plausible word, not a stray letter. */
const MIN_PREFIX = 3;

/** A compound split: `kávé` + `ház`. */
export interface CompoundSplit {
  prefix: string;
  head: string;
}

/**
 * Longest lemma in `known` that `word` ends with, subject to the length
 * guards. Returns `undefined` when the word does not look composed.
 */
export function splitCompound(word: string, known: ReadonlySet<string>): CompoundSplit | undefined {
  for (let start = MIN_PREFIX; start <= word.length - MIN_HEAD; start++) {
    const head = word.slice(start);
    if (known.has(head)) return { prefix: word.slice(0, start), head };
  }
  return undefined;
}

/**
 * The flags to inflect a compound with: the head's, but with alternate stems
 * rebased onto the whole word, and harmony pinned to the head — a compound
 * harmonizes with its final member even when earlier members disagree
 * (`halottkém` → `halottkémek`, never *halottkémok*).
 */
export function flagsForCompound(
  split: CompoundSplit,
  headFlags: StemFlags | undefined,
  backSet?: ReadonlySet<string>,
): StemFlags {
  const flags: StemFlags = { harmony: headFlags?.harmony ?? harmonyOf(split.head, backSet) };
  if (headFlags?.lowering) flags.lowering = headFlags.lowering;
  if (headFlags?.vowelPlural) flags.vowelPlural = headFlags.vowelPlural;
  if (headFlags?.shortening) flags.shortening = split.prefix + headFlags.shortening;
  if (headFlags?.fleeting) flags.fleeting = split.prefix + headFlags.fleeting;
  if (headFlags?.vStem) flags.vStem = split.prefix + headFlags.vStem;
  return flags;
}

/**
 * Flags for any Hungarian lemma: its own lexicon entry if it has one,
 * otherwise its compound head's, otherwise none.
 */
export function resolveStemFlags(
  lemma: string,
  lexicon: ReadonlyMap<string, StemFlags>,
  heads: ReadonlySet<string>,
  backSet?: ReadonlySet<string>,
): StemFlags | undefined {
  const own = lexicon.get(lemma);
  if (own) return own;
  const split = splitCompound(lemma, heads);
  if (!split) return undefined;
  return flagsForCompound(split, lexicon.get(split.head), backSet);
}
