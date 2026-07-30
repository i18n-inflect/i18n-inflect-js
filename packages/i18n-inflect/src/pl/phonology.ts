/**
 * Polish stem phonology.
 *
 * Polish endings are short and few; what makes the language hard is what
 * they do to the stem in front of them. The locative `-e` palatalizes the
 * final consonant, and it does so by rewriting the spelling: `kot` becomes
 * `kocie`, `Kraków` becomes `Krakowie`, `miasto` becomes `mieście`. Three
 * separate changes can land on one word — a consonant softens, a vowel
 * lowers, and an `ó` opens to `o`.
 *
 * These are the productive patterns. Where a word does not follow them the
 * generated lexicon carries its stem outright.
 */

/**
 * Consonants that stay put before `-e` because they are already soft, or
 * hardened (historically soft, now pronounced hard): `-e` after these is
 * spelled without an `i`, and the stem is unchanged.
 */
const ALREADY_SOFT = ["cz", "dz", "dż", "rz", "sz", "ż", "ś", "ć", "ź", "ń", "c", "j", "l"];

/**
 * The velars. They never take the locative `-e` in the masculine or the
 * neuter — those go to `-u` instead — but a feminine `-a` stem palatalizes
 * them all the way: `ręka` → `ręce`, `noga` → `nodze`, `mucha` → `musze`.
 */
const VELARS = ["k", "g", "ch"];

/** Two-consonant clusters palatalize as a unit. */
const CLUSTER_SOFTENING: [string, string][] = [
  ["st", "ści"],
  ["zd", "ździ"],
  ["sł", "śl"],
  ["zł", "źl"],
  ["sn", "śni"],
  ["zn", "źni"],
];

/** Single consonants and what they become before the locative `-e`. */
const SOFTENING: Record<string, string> = {
  p: "pi",
  b: "bi",
  f: "fi",
  w: "wi",
  m: "mi",
  n: "ni",
  s: "si",
  z: "zi",
  t: "ci",
  d: "dzi",
  ł: "l",
  r: "rz",
};

/** Velar palatalization, which only a feminine or a plural ending triggers. */
const VELAR_SOFTENING: Record<string, string> = { k: "c", g: "dz", ch: "sz" };

/**
 * True when the stem already ends in a soft or hardened consonant.
 *
 * A stem written with a final `i` counts: in `abonowani-` (from
 * `abonowanie`) the `i` *is* the softness of the `n`, and a soft stem takes
 * `-u` in the locative rather than palatalizing again.
 */
export function isSoft(stem: string): boolean {
  if (stem.length > 1 && stem.endsWith("i")) return true;
  return ALREADY_SOFT.some((c) => stem.endsWith(c));
}

/** True when the stem ends in `k`, `g` or `ch`. */
export function isVelar(stem: string): boolean {
  return VELARS.some((c) => stem.endsWith(c));
}

/**
 * `ó` and `ą` in a closed final syllable open up as soon as an ending is
 * added: `stół` → `stołu`, `ząb` → `zęba`, `Kraków` → `Krakowa`.
 *
 * This is regular enough to apply by default, and wrong often enough
 * (`król` → `króla`) that the lexicon has to be able to switch it off.
 */
export function openVowel(stem: string): string {
  const at = Math.max(stem.lastIndexOf("ó"), stem.lastIndexOf("ą"));
  if (at === -1) return stem;
  // Only the final syllable alternates. `bąbelek` keeps its `ą` because the
  // `ą` is not in the syllable the ending closes — `bąbelkiem`, not
  // *bębelkiem.
  if (/[aeiouyąęó]/.test(stem.slice(at + 1))) return stem;
  const opened = stem[at] === "ó" ? "o" : "ę";
  return stem.slice(0, at) + opened + stem.slice(at + 1);
}

/**
 * The `e` that only exists in the bare nominative: `pies` → `psa`,
 * `domek` → `domku`, `palec` → `palca`. It drops as soon as the ending
 * supplies a vowel of its own.
 */
export function dropFleetingE(stem: string): string {
  if (stem.length < 4) return stem;
  // Only the `-ek` and `-ec` suffixes drop productively. An `e` in any
  // other final syllable is part of the word: `adres` keeps its, and
  // `adresu` is not *adrsu.
  // `-iec` drops the whole `ie`, because the `i` is only there to mark the
  // consonant in front of it as soft: `chłopiec` → `chłopc-`.
  if (/[^aeiouyąęó]iec$/.test(stem)) return `${stem.slice(0, -3)}c`;
  if (!/e[kc]$/.test(stem)) return stem;
  const before = stem.at(-3) as string;
  if ("aeiouyąęó".includes(before)) return stem;
  return stem.slice(0, -2) + stem.slice(-1);
}

/**
 * Palatalize a stem for an ending that softens it — the locative `-e`, and
 * the feminine dative and locative.
 *
 * `velar` says whether `k g ch` should soften too: they do before a
 * feminine `-e` (`noga` → `nodze`) but not in the masculine, where the
 * locative goes to `-u` instead and this function is never called.
 */
export function palatalize(stem: string, velar = false): string {
  if (isSoft(stem)) return stem;

  if (velar) {
    for (const [hard, soft] of Object.entries(VELAR_SOFTENING)) {
      if (stem.endsWith(hard)) return stem.slice(0, -hard.length) + soft;
    }
  }

  for (const [cluster, soft] of CLUSTER_SOFTENING) {
    if (stem.endsWith(cluster)) return stem.slice(0, -cluster.length) + soft;
  }

  const last = stem.at(-1) as string;
  const soft = SOFTENING[last];
  return soft === undefined ? stem : stem.slice(0, -1) + soft;
}

/**
 * The `-y` / `-i` alternation.
 *
 * Polish cannot write `y` after a velar or a soft consonant, so the same
 * ending surfaces as `-i` there: `kot` → `koty` but `ptak` → `ptaki`.
 */
export function yOrI(stem: string): "y" | "i" {
  if (isVelar(stem)) return "i";
  if (/[śćźńlj]$/.test(stem) || stem.endsWith("dź")) return "i";
  return "y";
}
