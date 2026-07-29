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
 * Split a v-assimilating suffix (`-val/-vel`, `-vá/-vé`) into the stem and
 * the suffix as *written*.
 *
 * The `v` assimilates to the stem-final consonant and is written as a
 * geminate — digraphs doubling only their first letter, and never forming a
 * triple. The second copy of the grapheme belongs to the **suffix**, which
 * is what the hyphenated digit spellings expose: 5 (öt) → "5-tel",
 * 100 (száz) → "100-zal", 1 (egy) → "1-gyel".
 *
 * `rest` is the suffix without the `v` (e.g. `"al"`, `"el"`, `"á"`, `"é"`).
 */
export function assimilatingParts(stem: string, rest: string): { stem: string; suffix: string } {
  const final: FinalConsonant | undefined = finalConsonantOf(stem);
  if (!final) {
    // Vowel-final stems keep the v: hajó+val → hajóval (caller lengthens).
    return { stem, suffix: `v${rest}` };
  }
  // toll + val → tollal: the existing geminate absorbs the v.
  if (final.geminate) return { stem, suffix: rest };
  const g = final.grapheme;
  return { stem: stem.slice(0, stem.length - g.length) + g[0], suffix: g + rest };
}

/**
 * Attach a `v`-assimilating suffix (`-val/-vel`, `-vá/-vé`):
 *
 * - `ház` + `val` → `házzal`
 * - `ász` + `val` → `ásszal`
 * - `busz` + `val` → `busszal`
 * - `toll` + `val` → `tollal` (already geminate: no triple letter)
 */
export function attachAssimilating(stem: string, rest: string): string {
  const parts = assimilatingParts(stem, rest);
  return parts.stem + parts.suffix;
}
