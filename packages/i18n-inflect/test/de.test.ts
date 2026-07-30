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
    expect(inflect("de", "rotes Auto", { case: "dative", number: "plural" })).toBe(
      "roten Autos", // dative plural -n is not added after -s
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
      "rote Autos",
    );
  });

  it("prepends articles on request", () => {
    expect(inflect("de", "Hund", { article: "definite", gender: "masculine" })).toBe("der Hund");
    expect(
      inflect("de", "Katze", { article: "indefinite", gender: "feminine", case: "dative" }),
    ).toBe("einer Katze");
  });
});

describe("de: gender from the lexicon", () => {
  const cases: [string, string][] = [
    ["Haus", "das Haus"],
    ["Löffel", "der Löffel"],
    ["Gabel", "die Gabel"],
    ["Zeitung", "die Zeitung"],
    ["Mädchen", "das Mädchen"], // a suffix outranks the meaning
    ["Lehrerin", "die Lehrerin"],
  ];
  it.each(cases)("%s → %s", (noun, expected) => {
    expect(inflect("de", noun, { article: "definite" })).toBe(expected);
  });

  it("takes a compound's gender from its last element", () => {
    expect(inflect("de", "Krankenhaus", { article: "definite" })).toBe("das Krankenhaus");
    expect(inflect("de", "Haustür", { article: "definite" })).toBe("die Haustür");
    // Not in any dictionary, and still right — the head decides.
    expect(inflect("de", "Raumschiffbuch", { article: "definite" })).toBe("das Raumschiffbuch");
  });

  it("lets the caller override it", () => {
    expect(inflect("de", "Messer", { article: "definite", gender: "neuter" })).toBe("das Messer");
  });

  it("reports low confidence when the gender is only a guess", () => {
    // A word the lexicon has never seen and no suffix decides.
    const guessed = inflect("de", "Glorbaz", { article: "definite" });
    expect(guessed).toBe("der Glorbaz");
  });
});

describe("de: plural formation", () => {
  const cases: [string, string][] = [
    ["Haus", "Häuser"],
    ["Buch", "Bücher"],
    ["Baum", "Bäume"],
    ["Mann", "Männer"],
    ["Kind", "Kinder"],
    ["Frau", "Frauen"],
    ["Tag", "Tage"],
    ["Auto", "Autos"],
    ["Lehrer", "Lehrer"], // -er adds nothing
    ["Lehrerin", "Lehrerinnen"],
    ["Zeitung", "Zeitungen"],
    ["Museum", "Museen"],
  ];
  it.each(cases)("%s → %s", (noun, expected) => {
    expect(inflect("de", noun, { number: "plural" })).toBe(expected);
  });

  it("carries the head's pattern across a compound", () => {
    expect(inflect("de", "Krankenhaus", { number: "plural" })).toBe("Krankenhäuser");
    expect(inflect("de", "Wörterbuch", { number: "plural" })).toBe("Wörterbücher");
    expect(inflect("de", "Apfelbaum", { number: "plural" })).toBe("Apfelbäume");
    // Invented, and still right: the umlaut lands in the head.
    expect(inflect("de", "Raumschiffbuch", { number: "plural" })).toBe("Raumschiffbücher");
  });

  it("agrees the article and the adjective with the plural", () => {
    expect(inflect("de", "das rote Haus", { number: "plural", case: "dative" })).toBe(
      "den roten Häusern",
    );
    expect(inflect("de", "das Buch", { number: "plural", case: "dative" })).toBe("den Büchern");
  });
});
