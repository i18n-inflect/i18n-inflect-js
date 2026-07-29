import { describe, expect, it } from "vitest";
import { indefiniteArticle } from "../src/en/article.js";
import "../src/en/index.js";
import { pluralize } from "../src/en/plural.js";
import { format, inflect } from "../src/index.js";

describe("en: indefinite article", () => {
  const cases: [string, "a" | "an"][] = [
    ["cat", "a"],
    ["ace", "an"],
    ["hour", "an"],
    ["honest", "an"],
    ["heir", "an"],
    ["house", "a"],
    ["university", "a"],
    ["unicorn", "a"],
    ["uniform", "a"],
    ["unimportant", "an"],
    ["uninvited", "an"],
    ["umbrella", "an"],
    ["user", "a"],
    ["usual", "a"],
    ["utensil", "a"],
    ["utter", "an"],
    ["euro", "a"],
    ["European", "a"],
    ["ewe", "a"],
    ["one", "a"],
    ["once", "a"],
    ["MTA", "an"],
    ["SMS", "an"],
    ["FBI", "an"],
    ["UFO", "a"],
    ["BBC", "a"],
    ["X", "an"],
    ["8", "an"],
    ["80", "an"],
    ["800", "an"],
    ["11", "an"],
    ["18", "an"],
    ["5", "a"],
    ["110", "a"],
    ["100", "a"],
  ];
  it.each(cases)("%s → %s", (word, expected) => {
    expect(indefiniteArticle(word)).toBe(expected);
  });
});

describe("en: pluralization", () => {
  const cases: [string, string][] = [
    ["card", "cards"],
    ["box", "boxes"],
    ["church", "churches"],
    ["city", "cities"],
    ["day", "days"],
    ["knife", "knives"],
    ["wolf", "wolves"],
    ["hero", "heroes"],
    ["photo", "photos"],
    ["man", "men"],
    ["woman", "women"],
    ["child", "children"],
    ["person", "people"],
    ["sheep", "sheep"],
    ["series", "series"],
    ["PDF", "PDFs"],
    ["Mouse", "Mice"],
  ];
  it.each(cases)("%s → %s", (word, expected) => {
    expect(pluralize(word)).toBe(expected);
  });
});

describe("en: phrase-level agreement", () => {
  it("re-agrees an existing a/an after interpolation", () => {
    expect(format("en", "You drew ^[a {c}](article: indefinite)", { c: "ace" })).toBe(
      "You drew an ace",
    );
    expect(format("en", "You drew ^[a {c}](article: indefinite)", { c: "king" })).toBe(
      "You drew a king",
    );
  });

  it("re-agrees even without an explicit article feature", () => {
    expect(format("en", "^[an {x}](inflect: true)", { x: "sword" })).toBe("a sword");
  });

  it("keeps capitalization when replacing the article", () => {
    expect(format("en", "^[A {x}](inflect: true)", { x: "ace" })).toBe("An ace");
  });

  it("prepends an article when none is present", () => {
    expect(inflect("en", "ace", { article: "indefinite" })).toBe("an ace");
    expect(inflect("en", "ace", { article: "definite" })).toBe("the ace");
  });

  it("drops the indefinite article for plurals", () => {
    expect(inflect("en", "a card", { number: "plural" })).toBe("cards");
  });

  it("pluralizes the head of a multi-word phrase", () => {
    expect(inflect("en", "playing card", { number: "plural" })).toBe("playing cards");
  });

  it("removes articles on article: none", () => {
    expect(inflect("en", "the ace", { article: "none" })).toBe("ace");
  });

  it("leaves 'the' alone otherwise", () => {
    expect(inflect("en", "the ace", {})).toBe("the ace");
  });
});
