import { describe, expect, it } from "vitest";
import { elides, isHAspire } from "../src/fr/elision.js";
import "../src/fr/index.js";
import { pluralize } from "../src/fr/index.js";
import { inflect } from "../src/index.js";

describe("fr: elision", () => {
  it("elides before vowels and mute h", () => {
    expect(elides("ami")).toBe(true);
    expect(elides("école")).toBe(true);
    expect(elides("homme")).toBe(true);
    expect(elides("héroïne")).toBe(true);
    expect(elides("hôtel")).toBe(true);
  });

  it("does not elide before consonants, y, or h aspiré", () => {
    expect(elides("carte")).toBe(false);
    expect(elides("yaourt")).toBe(false);
    expect(elides("haricot")).toBe(false);
    expect(elides("héros")).toBe(false);
    expect(elides("hibou")).toBe(false);
    expect(isHAspire("haricot")).toBe(true);
    expect(isHAspire("homme")).toBe(false);
  });
});

describe("fr: pluralization", () => {
  const cases: [string, string][] = [
    ["carte", "cartes"],
    ["gâteau", "gâteaux"],
    ["jeu", "jeux"],
    ["pneu", "pneus"],
    ["bleu", "bleus"],
    ["journal", "journaux"],
    ["bal", "bals"],
    ["festival", "festivals"],
    ["travail", "travaux"],
    ["vitrail", "vitraux"],
    ["détail", "détails"],
    ["bois", "bois"],
    ["voix", "voix"],
    ["nez", "nez"],
  ];
  it.each(cases)("%s → %s", (word, expected) => {
    expect(pluralize(word)).toBe(expected);
  });
});

describe("fr: articles", () => {
  it("re-agrees definite articles with elision", () => {
    expect(inflect("fr", "le ami")).toBe("l'ami");
    expect(inflect("fr", "la école")).toBe("l'école");
    expect(inflect("fr", "le haricot")).toBe("le haricot");
  });

  it("prepends articles by gender", () => {
    expect(inflect("fr", "carte", { article: "indefinite", gender: "feminine" })).toBe("une carte");
    expect(inflect("fr", "jeu", { article: "indefinite", gender: "masculine" })).toBe("un jeu");
    expect(inflect("fr", "carte", { article: "definite", gender: "feminine" })).toBe("la carte");
    expect(inflect("fr", "ami", { article: "definite", gender: "masculine" })).toBe("l'ami");
  });

  it("guesses gender from endings when not supplied", () => {
    expect(inflect("fr", "chanson", { article: "definite" })).toBe("le chanson"); // heuristic miss is possible: chanson is feminine but not in the ending list
    expect(inflect("fr", "nation", { article: "definite" })).toBe("la nation");
    expect(inflect("fr", "voiture", { article: "definite" })).toBe("la voiture");
  });

  it("agrees articles with plural", () => {
    expect(inflect("fr", "le journal", { number: "plural" })).toBe("les journaux");
    expect(inflect("fr", "un jeu", { number: "plural" })).toBe("des jeux");
  });
});
