import { describe, expect, it } from "vitest";
import { format, inflect } from "../src/index.js";
import "../src/pl/index.js";
import { agreeAdjective } from "../src/pl/adjectives.js";
import { palatalize, yOrI } from "../src/pl/phonology.js";

/**
 * Polish agreement.
 *
 * Seven cases, and the ending is the easy half: what makes Polish hard is
 * what the ending does to the stem in front of it. `kot` becomes `kocie`,
 * `pies` becomes `psa`, `stół` becomes `stołu` — a consonant softens, a
 * vowel disappears, a vowel opens.
 */

const inf = (phrase: string, features: Parameters<typeof inflect>[2]) =>
  inflect("pl", phrase, features);

describe("pl: stem phonology", () => {
  it("palatalizes before the locative -e", () => {
    expect(palatalize("kot")).toBe("koci");
    expect(palatalize("dom")).toBe("domi");
    expect(palatalize("rower")).toBe("rowerz");
    expect(palatalize("miast")).toBe("mieści".replace("mie", "mia")); // st → ści
  });

  it("softens velars only where a feminine ending asks", () => {
    expect(palatalize("nog", true)).toBe("nodz");
    expect(palatalize("ręk", true)).toBe("ręc");
    expect(palatalize("nog")).toBe("nog");
  });

  it("chooses -y or -i by what precedes", () => {
    expect(yOrI("kot")).toBe("y");
    expect(yOrI("ptak")).toBe("i");
    expect(yOrI("koń")).toBe("i");
  });
});

describe("pl: masculine nouns", () => {
  const cases: [string, Parameters<typeof inflect>[2], string][] = [
    ["kot", { case: "accusative" }, "kota"], // animate: accusative copies genitive
    ["kot", { case: "genitive" }, "kota"],
    ["kot", { case: "inessive" }, "kocie"], // locative palatalizes
    ["kot", { case: "instrumental" }, "kotem"],
    ["kot", { number: "plural" }, "koty"],
    ["kot", { number: "plural", case: "genitive" }, "kotów"],
    ["dom", { case: "genitive" }, "domu"], // inanimate: -u
    ["dom", { case: "inessive" }, "domu"],
    ["pies", { case: "genitive" }, "psa"], // the e was only in the nominative
    ["stół", { case: "genitive" }, "stołu"], // ó opens to o
    ["stół", { case: "inessive" }, "stole"],
  ];
  it.each(cases)("%s + %o → %s", (phrase, features, expected) => {
    expect(inf(phrase, features)).toBe(expected);
  });

  it("treats men differently from things", () => {
    expect(inf("student", { case: "accusative" })).toBe("studenta");
    expect(inf("student", { number: "plural" })).toBe("studenci"); // t → ci
    expect(inf("student", { number: "plural", case: "accusative" })).toBe("studentów");
    expect(inf("Polak", { number: "plural" })).toBe("Polacy"); // k → c
  });

  it("drops the -in of a group member in the plural", () => {
    expect(inf("Amerykanin", { number: "plural" })).toBe("Amerykanie");
    expect(inf("Amerykanin", { number: "plural", case: "genitive" })).toBe("Amerykanów");
  });
});

describe("pl: feminine and neuter nouns", () => {
  const cases: [string, Parameters<typeof inflect>[2], string][] = [
    ["książka", { case: "genitive" }, "książki"],
    ["książka", { case: "dative" }, "książce"], // k → c before -e
    ["książka", { case: "accusative" }, "książkę"],
    ["książka", { number: "plural", case: "genitive" }, "książek"], // e reappears
    ["noga", { case: "dative" }, "nodze"], // g → dz
    ["ręka", { case: "dative" }, "ręce"],
    ["okno", { case: "inessive" }, "oknie"],
    ["okno", { number: "plural" }, "okna"],
    ["okno", { number: "plural", case: "genitive" }, "okien"],
    ["muzeum", { case: "genitive" }, "muzeum"], // indeclinable in the singular
    ["muzeum", { number: "plural" }, "muzea"],
  ];
  it.each(cases)("%s + %o → %s", (phrase, features, expected) => {
    expect(inf(phrase, features)).toBe(expected);
  });
});

describe("pl: adjective agreement", () => {
  it("agrees in gender, number and case", () => {
    expect(inf("czerwony samochód", { case: "genitive" })).toBe("czerwonego samochodu");
    expect(inf("czerwony samochód", { case: "instrumental" })).toBe("czerwonym samochodem");
    expect(inf("dobra książka", { case: "genitive" })).toBe("dobrej książki");
    expect(inf("dobra książka", { number: "plural", case: "instrumental" })).toBe(
      "dobrymi książkami",
    );
    expect(inf("nowy dom", { case: "inessive" })).toBe("nowym domu");
  });

  it("uses -i endings after a velar stem", () => {
    expect(agreeAdjective("polski", "masculine", "genitive", false)).toBe("polskiego");
    expect(agreeAdjective("polski", "masculine", "instrumental", false)).toBe("polskim");
  });

  it("has a separate plural for groups of men", () => {
    expect(agreeAdjective("dobry", "masculine", "nominative", true, { personal: true })).toBe(
      "dobrzy",
    );
    expect(agreeAdjective("dobry", "masculine", "nominative", true)).toBe("dobre");
  });
});

describe("pl: through the template layer", () => {
  it("declines the interpolated value", () => {
    expect(format("pl", "Widzę ^[{x}](case: accusative)", { x: "kot" })).toBe("Widzę kota");
    expect(format("pl", "Mieszkam w ^[{x}](case: inessive)", { x: "nowy dom" })).toBe(
      "Mieszkam w nowym domu",
    );
  });
});
