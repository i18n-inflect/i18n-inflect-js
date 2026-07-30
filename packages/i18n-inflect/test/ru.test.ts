import { describe, expect, it } from "vitest";
import { format, inflect } from "../src/index.js";
import "../src/ru/index.js";
import { adjectiveStem, agreeAdjective, isSoftStem } from "../src/ru/adjectives.js";

/**
 * Russian agreement.
 *
 * Six cases, and most of the work is done by one decision per noun: hard
 * stem or soft. `-а`/`-я`, `-у`/`-ю`, `-ом`/`-ем`, `-ы`/`-и` are the same
 * endings twice over. What the paradigm cannot derive is animacy — whether
 * the accusative copies the nominative or the genitive — and that comes
 * from the lexicon.
 */

const inf = (phrase: string, features: Parameters<typeof inflect>[2]) =>
  inflect("ru", phrase, features);

describe("ru: masculine nouns", () => {
  const cases: [string, Parameters<typeof inflect>[2], string][] = [
    ["стол", { case: "genitive" }, "стола"],
    ["стол", { case: "inessive" }, "столе"],
    ["стол", { case: "instrumental" }, "столом"],
    ["стол", { number: "plural" }, "столы"],
    ["стол", { number: "plural", case: "genitive" }, "столов"],
    ["музей", { case: "genitive" }, "музея"], // soft stem
    ["музей", { case: "instrumental" }, "музеем"],
    ["музей", { number: "plural", case: "genitive" }, "музеев"],
    ["немец", { case: "genitive" }, "немца"], // the е was only in the nominative
    ["немец", { case: "instrumental" }, "немцем"], // no unstressed о after ц
    ["немец", { number: "plural", case: "genitive" }, "немцев"],
  ];
  it.each(cases)("%s + %o → %s", (phrase, features, expected) => {
    expect(inf(phrase, features)).toBe(expected);
  });

  it("copies the genitive into the accusative for living things", () => {
    expect(inf("кот", { case: "accusative" })).toBe("кота");
    expect(inf("кот", { number: "plural", case: "accusative" })).toBe("котов");
    expect(inf("стол", { case: "accusative" })).toBe("стол");
    expect(inf("стол", { number: "plural", case: "accusative" })).toBe("столы");
  });
});

describe("ru: feminine and neuter nouns", () => {
  const cases: [string, Parameters<typeof inflect>[2], string][] = [
    ["книга", { case: "genitive" }, "книги"], // no ы after г
    ["книга", { case: "dative" }, "книге"],
    ["книга", { case: "accusative" }, "книгу"],
    ["книга", { number: "plural" }, "книги"],
    ["книга", { number: "plural", case: "genitive" }, "книг"],
    ["гистология", { case: "dative" }, "гистологии"], // -ия takes -и, not -е
    ["гистология", { case: "inessive" }, "гистологии"],
    ["окно", { case: "genitive" }, "окна"],
    ["окно", { number: "plural" }, "окна"],
    ["окно", { number: "plural", case: "genitive" }, "окон"], // the vowel comes back
    ["ночь", { case: "genitive" }, "ночи"],
    ["ночь", { case: "instrumental" }, "ночью"],
    ["ночь", { number: "plural" }, "ночи"],
  ];
  it.each(cases)("%s + %o → %s", (phrase, features, expected) => {
    expect(inf(phrase, features)).toBe(expected);
  });
});

describe("ru: adjective agreement", () => {
  it("agrees in gender, number and case", () => {
    expect(inf("красивый стол", { case: "genitive" })).toBe("красивого стола");
    expect(inf("красивый стол", { case: "instrumental" })).toBe("красивым столом");
    expect(inf("новая книга", { case: "dative" })).toBe("новой книге");
    expect(inf("новая книга", { number: "plural", case: "genitive" })).toBe("новых книг");
  });

  it("applies the spelling rules to the endings", () => {
    expect(inf("русский язык", { case: "inessive" })).toBe("русском языке");
    expect(agreeAdjective("русский", "masculine", "nominative", true)).toBe("русские");
    expect(agreeAdjective("хороший", "masculine", "genitive", false)).toBe("хорошего");
  });

  it("tells a soft stem from one that only looks soft", () => {
    expect(isSoftStem("синий")).toBe(true);
    expect(isSoftStem("русский")).toBe(false);
    expect(adjectiveStem("красивый")).toBe("красив");
    expect(agreeAdjective("синий", "feminine", "nominative", false)).toBe("синяя");
  });

  it("follows the noun into the animate accusative", () => {
    expect(inf("синий кот", { case: "accusative" })).toBe("синего кота");
    expect(inf("красивый стол", { case: "accusative" })).toBe("красивый стол");
  });
});

describe("ru: through the template layer", () => {
  it("declines the interpolated value", () => {
    expect(format("ru", "Я живу в ^[{x}](case: inessive)", { x: "новый дом" })).toBe(
      "Я живу в новом доме",
    );
    expect(format("ru", "Я вижу ^[{x}](case: accusative)", { x: "кот" })).toBe("Я вижу кота");
  });
});
