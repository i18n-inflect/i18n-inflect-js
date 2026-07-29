import { type FinalConsonant, finalConsonantOf } from "./phonology.js";

/**
 * Hungarian orthography helpers: low-vowel lengthening and consonant
 * gemination as *written*, digraphs included.
 */

/**
 * Word-final `a`/`e` lengthen before (nearly) every suffix:
 * `fa` → `fá-` (fát), `medve` → `medvé-` (medvét).
 */
export function lengthenFinalVowel(stem: string): string {
  const last = stem.at(-1);
  if (last === "a") return `${stem.slice(0, -1)}á`;
  if (last === "e") return `${stem.slice(0, -1)}é`;
  if (last === "A") return `${stem.slice(0, -1)}Á`;
  if (last === "E") return `${stem.slice(0, -1)}É`;
  return stem;
}

/**
 * Attach a `v`-assimilating suffix (`-val/-vel`, `-vá/-vé`): the `v`
 * assimilates to a final consonant, written as a geminate — with digraphs
 * doubling only their first letter, and never creating a triple:
 *
 * - `ház` + `val` → `házzal`
 * - `ász` + `val` → `ásszal`
 * - `busz` + `val` → `busszal`
 * - `toll` + `val` → `tollal` (already geminate: no triple letter)
 *
 * `rest` is the suffix without the `v` (e.g. `"al"`, `"el"`, `"á"`, `"é"`).
 */
export function attachAssimilating(stem: string, rest: string): string {
  const final: FinalConsonant | undefined = finalConsonantOf(stem);
  if (!final) {
    // Vowel-final stems keep the v: hajó+val → hajóval (caller lengthens).
    return `${stem}v${rest}`;
  }
  if (final.geminate) {
    // toll + val → tollal: the geminate absorbs the v.
    return stem + rest;
  }
  // Double the final grapheme in writing: z→zz, sz→ssz. The written geminate
  // of a digraph doubles its FIRST letter before the digraph: á|sz → á|s|sz.
  const g = final.grapheme;
  return `${stem.slice(0, stem.length - g.length)}${g[0]}${g}${rest}`;
}
