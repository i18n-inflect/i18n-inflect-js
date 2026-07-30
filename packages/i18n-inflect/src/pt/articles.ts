/**
 * Portuguese articles and their contractions with prepositions.
 *
 * Portuguese has no case endings; the role a case marks elsewhere is marked
 * here by a preposition, and the preposition then *fuses* with the article
 * that follows it. `de + o` is not written `de o` but `do`, and this is
 * obligatory, not a stylistic contraction — which is exactly the kind of
 * thing an interpolated string gets wrong. `Vim de o Porto` is broken
 * Portuguese; `Vim do Porto` is the sentence.
 *
 * The fusion with `a` also produces the crase: `a + a` is written `à`, with
 * the grave accent as the only trace of the two vowels.
 */

/** Portuguese distinguishes two genders. */
export type PtGender = "masculine" | "feminine";

/** The prepositions this pack can put in front of a noun phrase. */
export type PtPreposition = "de" | "a" | "em" | "por" | "com" | "para";

type Slot = "ms" | "fs" | "mp" | "fp";

function slot(gender: PtGender, plural: boolean): Slot {
  return gender === "feminine" ? (plural ? "fp" : "fs") : plural ? "mp" : "ms";
}

const DEFINITE: Record<Slot, string> = { ms: "o", fs: "a", mp: "os", fp: "as" };
const INDEFINITE: Record<Slot, string> = { ms: "um", fs: "uma", mp: "uns", fp: "umas" };

/** `o`, `a`, `os`, `as`. */
export function definiteArticle(gender: PtGender, plural: boolean): string {
  return DEFINITE[slot(gender, plural)];
}

/** `um`, `uma`, `uns`, `umas`. */
export function indefiniteArticle(gender: PtGender, plural: boolean): string {
  return INDEFINITE[slot(gender, plural)];
}

/**
 * Preposition + definite article, fused.
 *
 * `com` and `para` are the two that do not fuse in the standard written
 * language — `com o`, `para o` stay apart — so they are absent here and
 * fall back to two words.
 */
const WITH_DEFINITE: Partial<Record<PtPreposition, Record<Slot, string>>> = {
  de: { ms: "do", fs: "da", mp: "dos", fp: "das" },
  em: { ms: "no", fs: "na", mp: "nos", fp: "nas" },
  a: { ms: "ao", fs: "à", mp: "aos", fp: "às" },
  por: { ms: "pelo", fs: "pela", mp: "pelos", fp: "pelas" },
};

/**
 * Preposition + indefinite article.
 *
 * Only `em` fuses in both standard varieties (`num`, `numa`). `de` fuses to
 * `dum` in European Portuguese but is normally written apart in Brazil, so
 * this pack leaves it apart: the two-word form is correct everywhere.
 */
const WITH_INDEFINITE: Partial<Record<PtPreposition, Record<Slot, string>>> = {
  em: { ms: "num", fs: "numa", mp: "nuns", fp: "numas" },
};

/**
 * The article as it is written after a preposition — fused where Portuguese
 * fuses, two words where it does not.
 */
export function withPreposition(
  preposition: PtPreposition,
  kind: "definite" | "indefinite",
  gender: PtGender,
  plural: boolean,
): string {
  const table = kind === "definite" ? WITH_DEFINITE : WITH_INDEFINITE;
  const fused = table[preposition]?.[slot(gender, plural)];
  if (fused !== undefined) return fused;
  const article =
    kind === "definite" ? definiteArticle(gender, plural) : indefiniteArticle(gender, plural);
  return `${preposition} ${article}`;
}
