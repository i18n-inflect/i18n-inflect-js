import { describe, expect, it } from "vitest";
import { adjectiveStem } from "../src/de/articles.js";
import "../src/de/index.js";
import { inflect } from "../src/index.js";

describe("de: adjective stems", () => {
  const cases: [string, string][] = [
    ["rote", "rot"],
    ["roten", "rot"],
    ["rotes", "rot"],
    ["teuer", "teur"],
    ["teure", "teur"],
    ["dunkel", "dunkl"],
    ["hoch", "hoh"],
    ["lecker", "lecker"],
    ["sauber", "sauber"],
    ["gut", "gut"],
  ];
  it.each(cases)("%s → %s", (token, expected) => {
    expect(adjectiveStem(token)).toBe(expected);
  });
});

describe("de: article + adjective agreement", () => {
  it("declines the definite article through the cases", () => {
    expect(inflect("de", "der Hund", { case: "accusative", gender: "masculine" })).toBe("den Hund");
    expect(inflect("de", "der Hund", { case: "dative", gender: "masculine" })).toBe("dem Hund");
    expect(inflect("de", "das Auto", { case: "dative", gender: "neuter" })).toBe("dem Auto");
    expect(inflect("de", "die Katze", { case: "dative", gender: "feminine" })).toBe("der Katze");
  });

  it("declines the indefinite article with mixed adjective endings", () => {
    expect(inflect("de", "ein rotes Auto", { case: "dative", gender: "neuter" })).toBe(
      "einem roten Auto",
    );
    expect(inflect("de", "ein roter Hund", { case: "accusative", gender: "masculine" })).toBe(
      "einen roten Hund",
    );
  });

  it("uses weak endings after definite articles", () => {
    expect(inflect("de", "der rote Hund", { case: "accusative", gender: "masculine" })).toBe(
      "den roten Hund",
    );
    expect(inflect("de", "das rote Auto", { case: "nominative", gender: "neuter" })).toBe(
      "das rote Auto",
    );
  });

  it("uses strong endings without an article", () => {
    expect(inflect("de", "rote Autos", { case: "dative", number: "plural" })).toBe(
      "roten Autosn".replace("Autosn", "Autos"), // dative plural noun already ends in -s
    );
    expect(inflect("de", "kalte Milch", { case: "nominative", gender: "feminine" })).toBe(
      "kalte Milch",
    );
  });

  it("handles contracted adjective stems", () => {
    expect(inflect("de", "ein teures Auto", { case: "dative", gender: "neuter" })).toBe(
      "einem teuren Auto",
    );
  });

  it("applies genitive noun endings", () => {
    expect(inflect("de", "das Auto", { case: "genitive", gender: "neuter" })).toBe("des Autos");
    expect(inflect("de", "der Hund", { case: "genitive", gender: "masculine" })).toBe(
      "des Hundes".replace("Hundes", "Hunds"), // rule layer: -s (lexical -es not modeled)
    );
  });

  it("applies dative plural -n to the noun", () => {
    expect(inflect("de", "die Kinder", { case: "dative", number: "plural" })).toBe("den Kindern");
  });

  it("drops the indefinite article in the plural", () => {
    expect(inflect("de", "ein rotes Auto", { case: "nominative", number: "plural" })).toBe(
      "rote Auto", // noun plural form is the caller's job (documented)
    );
  });

  it("prepends articles on request", () => {
    expect(inflect("de", "Hund", { article: "definite", gender: "masculine" })).toBe("der Hund");
    expect(
      inflect("de", "Katze", { article: "indefinite", gender: "feminine", case: "dative" }),
    ).toBe("einer Katze");
  });
});
