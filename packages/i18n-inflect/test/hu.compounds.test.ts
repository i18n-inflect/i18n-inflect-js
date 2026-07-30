import { describe, expect, it } from "vitest";
import { splitCompound } from "../src/hu/compounds.js";
import "../src/hu/index.js";
import { relationalAdjective } from "../src/hu/derivation.js";
import { format, inflect } from "../src/index.js";

describe("hu: compound splitting", () => {
  const known = new Set(["ház", "víz", "tűz", "sugár", "ér", "hely"]);

  it("finds the longest known head", () => {
    expect(splitCompound("kávéház", known)).toEqual({ prefix: "kávé", head: "ház" });
    expect(splitCompound("fénysugár", known)).toEqual({ prefix: "fény", head: "sugár" });
  });

  it("refuses heads and prefixes that are too short to be evidence", () => {
    // "ér" would otherwise fire on ordinary words like pincér.
    expect(splitCompound("pincér", known)).toBeUndefined();
    // A two-letter prefix is not a plausible first member.
    expect(splitCompound("ivóvíz".slice(2), known)).toBeUndefined();
  });

  it("ignores words that merely are a known lemma", () => {
    expect(splitCompound("ház", known)).toBeUndefined();
  });
});

describe("hu: compounds inflect after their final member", () => {
  const cases: [string, Parameters<typeof inflect>[2], string][] = [
    // ház lowers its linking vowel, and so does anything ending in it
    ["kávéház", { case: "accusative" }, "kávéházat"],
    ["kávéház", { number: "plural" }, "kávéházak"],
    ["tyúkház", { case: "accusative" }, "tyúkházat"],
    // stem alternations rebase onto the whole word
    ["forrásvíz", { case: "accusative" }, "forrásvizet"],
    ["tábortűz", { case: "accusative" }, "tábortüzet"],
    ["fénysugár", { number: "plural" }, "fénysugarak"],
    // harmony follows the head, not the whole word
    ["ivóvíz", { case: "dative" }, "ivóvíznek"],
  ];
  it.each(cases)("%s + %o → %s", (word, features, expected) => {
    expect(inflect("hu", word, features)).toBe(expected);
  });

  it("leaves simple words alone", () => {
    expect(inflect("hu", "asztal", { case: "accusative" })).toBe("asztalt");
    expect(inflect("hu", "pincér", { case: "accusative" })).toBe("pincért");
  });
});

describe("hu: relational adjective (-i)", () => {
  const cases: [string, string][] = [
    ["Budapest", "budapesti"],
    ["Szeged", "szegedi"],
    ["Pécs", "pécsi"],
    ["Győr", "győri"],
    ["Kanada", "kanadai"], // no lengthening, unlike every case suffix
    ["Európa", "európai"],
    ["Szentendre", "szentendrei"],
    ["Tokió", "tokiói"],
    ["Helsinki", "helsinki"], // the suffix is absorbed
    ["ma", "mai"],
    ["Eger", "egri"],
    ["falu", "falusi"],
    ["holnap", "holnapi"],
    ["iskola", "iskolai"],
  ];
  it.each(cases)("%s → %s", (word, expected) => {
    expect(relationalAdjective(word)).toBe(expected);
    expect(inflect("hu", word, { derivation: "relational" })).toBe(expected);
  });

  it("uses the fleeting stem when the lexicon knows one", () => {
    expect(relationalAdjective("bokor", { fleeting: "bokr" })).toBe("bokri");
  });

  it("inflects the derived adjective as its own word", () => {
    expect(inflect("hu", "Budapest", { derivation: "relational", number: "plural" })).toBe(
      "budapestiek",
    );
    expect(inflect("hu", "Kanada", { derivation: "relational", number: "plural" })).toBe(
      "kanadaiak",
    );
    expect(inflect("hu", "Budapest", { derivation: "relational", case: "accusative" })).toBe(
      "budapestit",
    );
    expect(inflect("hu", "Szeged", { derivation: "relational", case: "inessive" })).toBe(
      "szegediben",
    );
  });

  it("works through the template layer, with the article agreeing", () => {
    expect(format("hu", "^[a {city}](derivation: relational) járat", { city: "Budapest" })).toBe(
      "a budapesti járat",
    );
    expect(format("hu", "^[a {city}](derivation: relational)", { city: "Eger" })).toBe("az egri");
  });
});
