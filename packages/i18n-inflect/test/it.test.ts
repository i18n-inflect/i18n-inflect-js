import { describe, expect, it as test } from "vitest";
import { format, inflect } from "../src/index.js";
import "../src/it/index.js";
import { needsLo, startsWithVowel } from "../src/it/articles.js";
import { pluralize } from "../src/it/plural.js";

/**
 * Italian agreement.
 *
 * The article is chosen by the sound of the word that follows it, not by
 * gender alone, and prepositions fuse with it — *di il libro* is not a
 * clumsy Italian sentence, it is not Italian at all.
 */

const definite = (word: string, plural = false) =>
  inflect("it", word, { article: "definite", ...(plural ? { number: "plural" as const } : {}) });

describe("it: phonological article selection", () => {
  test("recognizes the clusters that force lo", () => {
    expect(needsLo("sport")).toBe(true); // s + consonant
    expect(needsLo("zaino")).toBe(true); // z
    expect(needsLo("gnomo")).toBe(true); // gn
    expect(needsLo("psicologo")).toBe(true); // ps
    expect(needsLo("yogurt")).toBe(true); // y
    expect(needsLo("sale")).toBe(false); // s + vowel
    expect(needsLo("libro")).toBe(false);
    expect(startsWithVowel("amico")).toBe(true);
  });

  const cases: [string, boolean, string][] = [
    ["libro", false, "il libro"],
    ["sport", false, "lo sport"],
    ["zaino", false, "lo zaino"],
    ["studente", false, "lo studente"],
    ["amico", false, "l'amico"],
    ["casa", false, "la casa"],
    ["amica", false, "l'amica"],
    ["libro", true, "i libri"],
    ["sport", true, "gli sport"],
    ["amico", true, "gli amici"],
    ["casa", true, "le case"],
    ["zaino", true, "gli zaini"],
  ];
  test.each(cases)("%s%s → %s", (word, plural, expected) => {
    expect(definite(word, plural)).toBe(expected);
  });

  test("picks un, uno or un' for the indefinite", () => {
    expect(inflect("it", "libro", { article: "indefinite" })).toBe("un libro");
    expect(inflect("it", "sport", { article: "indefinite" })).toBe("uno sport");
    expect(inflect("it", "amica", { article: "indefinite" })).toBe("un'amica");
    expect(inflect("it", "casa", { article: "indefinite" })).toBe("una casa");
  });
});

describe("it: articulated prepositions", () => {
  const cases: [string, Parameters<typeof inflect>[2], string][] = [
    ["libro", { case: "genitive" }, "del libro"],
    ["sport", { case: "genitive" }, "dello sport"],
    ["amico", { case: "genitive" }, "dell'amico"],
    ["casa", { case: "genitive" }, "della casa"],
    ["libro", { case: "dative" }, "al libro"],
    ["sport", { case: "dative" }, "allo sport"],
    ["libro", { case: "ablative" }, "dal libro"],
    ["casa", { case: "inessive" }, "nella casa"],
    ["tavolo", { case: "superessive" }, "sul tavolo"],
    ["libro", { case: "genitive", number: "plural" }, "dei libri"],
    ["amico", { case: "genitive", number: "plural" }, "degli amici"],
    ["casa", { case: "dative", number: "plural" }, "alle case"],
  ];
  test.each(cases)("%s + %o → %s", (word, features, expected) => {
    expect(inflect("it", word, features)).toBe(expected);
  });
});

describe("it: pluralization keeps the consonant sound", () => {
  const cases: [string, string][] = [
    ["libro", "libri"],
    ["casa", "case"],
    ["studente", "studenti"],
    ["amico", "amici"], // the c softens
    ["fuoco", "fuochi"], // …but not here
    ["lago", "laghi"],
    ["amica", "amiche"],
    ["banca", "banche"],
    ["città", "città"], // stressed final vowel: invariant
    ["sport", "sport"], // consonant final: invariant
    ["braccio", "braccia"], // masculine singular, feminine plural
    ["uovo", "uova"],
  ];
  test.each(cases)("%s → %s", (word, expected) => {
    expect(pluralize(word)).toBe(expected);
  });
});

describe("it: gender comes from the lexicon where the ending misleads", () => {
  test("gets the classic traps right without being told", () => {
    expect(definite("mano")).toBe("la mano"); // -o but feminine
    expect(definite("problema")).toBe("il problema"); // -a but masculine
    expect(definite("foto")).toBe("la foto");
    expect(definite("poeta")).toBe("il poeta");
  });

  test("declines to guess when a word has two genders", () => {
    // `il radio` is radium, `la radio` is the wireless; `l'artista` can be
    // either. The extractor drops such words rather than pick, so the
    // ending heuristic answers and the caller can override it.
    expect(definite("radio")).toBe("il radio");
    expect(inflect("it", "radio", { article: "definite", gender: "feminine" })).toBe("la radio");
  });

  test("still accepts an explicit gender", () => {
    expect(inflect("it", "artista", { article: "definite", gender: "masculine" })).toBe(
      "l'artista",
    );
  });
});

describe("it: through the template layer", () => {
  test("agrees the article with the interpolated value", () => {
    expect(format("it", "Ho letto ^[il {x}](article: definite)", { x: "libro" })).toBe(
      "Ho letto il libro",
    );
    expect(format("it", "Ho letto ^[il {x}](article: definite)", { x: "studente" })).toBe(
      "Ho letto lo studente",
    );
    expect(format("it", "Parlo ^[{x}](case: genitive)", { x: "amico" })).toBe("Parlo dell'amico");
  });
});
