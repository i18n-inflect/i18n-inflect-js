import { describe, expect, it } from "vitest";
import { format, inflect } from "../src/index.js";
import "../src/pt/index.js";
import { pluralize } from "../src/pt/nouns.js";

/**
 * Portuguese agreement.
 *
 * The interesting part is not the article but what happens when a
 * preposition meets it: `de + o` is written `do`, and writing `de o` is not
 * a stylistic slip but an error. Interpolating a place name into a sentence
 * therefore changes a word that is nowhere near the placeholder.
 */

const inf = (phrase: string, features: Parameters<typeof inflect>[2]) =>
  inflect("pt", phrase, features);

describe("pt: gender and articles", () => {
  const cases: [string, string][] = [
    ["casa", "a casa"],
    ["livro", "o livro"],
    ["cidade", "a cidade"],
    ["problema", "o problema"], // Greek -ma against the -a rule
    ["coração", "o coração"], // not a -ção derivation, whatever it looks like
  ];
  it.each(cases)("%s → %s", (noun, expected) => {
    expect(inf(noun, { article: "definite" })).toBe(expected);
  });

  it("uses the indefinite article", () => {
    expect(inf("casa", { article: "indefinite" })).toBe("uma casa");
    expect(inf("livro", { article: "indefinite" })).toBe("um livro");
  });

  it("lets the caller override the gender", () => {
    expect(inf("cabeça", { article: "definite", gender: "masculine" })).toBe("o cabeça");
  });
});

describe("pt: plurals", () => {
  const cases: [string, string][] = [
    ["casa", "casas"],
    ["livro", "livros"],
    ["coração", "corações"],
    ["pão", "pães"], // one of the three -ão plurals; lexical
    ["mão", "mãos"],
    ["animal", "animais"],
    ["papel", "papéis"],
    ["fóssil", "fósseis"], // unstressed -il
    ["fuzil", "fuzis"], // stressed -il
    ["homem", "homens"],
    ["luz", "luzes"],
    ["país", "países"],
    ["lápis", "lápis"], // stress is not on the last syllable
  ];
  it.each(cases)("%s → %s", (noun, expected) => {
    expect(inf(noun, { number: "plural" })).toBe(expected);
  });

  it("agrees the article and the adjective with the noun", () => {
    expect(inf("casa branca", { number: "plural", article: "definite" })).toBe("as casas brancas");
    expect(inf("livro", { number: "plural", article: "definite" })).toBe("os livros");
  });

  it("exposes the rules on their own", () => {
    expect(pluralize("cidade")).toBe("cidades");
    expect(pluralize("mar")).toBe("mares");
  });
});

describe("pt: preposition + article contractions", () => {
  const cases: [string, Parameters<typeof inflect>[2], string][] = [
    ["casa", { case: "genitive" }, "da casa"],
    ["livro", { case: "genitive" }, "do livro"],
    ["livro", { case: "genitive", number: "plural" }, "dos livros"],
    ["casa", { case: "dative" }, "à casa"], // the crase: a + a
    ["livro", { case: "dative" }, "ao livro"],
    ["casa", { case: "dative", number: "plural" }, "às casas"],
    ["livro", { case: "inessive" }, "no livro"],
    ["casa", { case: "inessive" }, "na casa"],
    ["casa", { case: "inessive", article: "indefinite" }, "numa casa"],
    ["livro", { case: "instrumental" }, "com o livro"], // com does not fuse
  ];
  it.each(cases)("%s + %o → %s", (phrase, features, expected) => {
    expect(inf(phrase, features)).toBe(expected);
  });

  it("replaces an article that is already there", () => {
    expect(inf("a casa", { case: "genitive" })).toBe("da casa");
    expect(inf("o livro", { case: "inessive", number: "plural" })).toBe("nos livros");
  });
});

describe("pt: through the template layer", () => {
  it("contracts across the placeholder", () => {
    expect(format("pt", "Venho ^[{x}](case: genitive)", { x: "Porto" })).toBe("Venho do Porto");
    expect(format("pt", "Vou ^[{x}](case: dative)", { x: "cidade" })).toBe("Vou à cidade");
  });
});
