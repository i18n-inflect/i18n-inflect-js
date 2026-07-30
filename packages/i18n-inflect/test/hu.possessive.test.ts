import { describe, expect, it } from "vitest";
import "../src/hu/index.js";
import { format, inflect } from "../src/index.js";

/**
 * Possession and the essive-formal case.
 *
 * The possessive paradigm is where every stem class shows through at once,
 * and where Hungarian keeps one genuinely lexical choice: the third person
 * takes `-a/-e` for some words and `-ja/-je` for others, with nothing in the
 * shape of the word to say which.
 */

const owned = (
  word: string,
  person: "first" | "second" | "third",
  ownerPlural = false,
  manyOwned = false,
) =>
  inflect("hu", word, {
    possessor: person,
    ...(ownerPlural ? { possessorNumber: "plural" as const } : {}),
    ...(manyOwned ? { number: "plural" as const } : {}),
  });

describe("hu: one owner, one thing", () => {
  const cases: [string, "first" | "second" | "third", string][] = [
    ["ház", "first", "házam"],
    ["ház", "second", "házad"],
    ["ház", "third", "háza"],
    ["kert", "first", "kertem"],
    ["kert", "third", "kertje"],
    ["gyümölcs", "first", "gyümölcsöm"],
    ["alma", "first", "almám"],
    ["alma", "third", "almája"],
    ["kapu", "third", "kapuja"],
    ["kéz", "first", "kezem"],
    ["ló", "first", "lovam"],
    ["bokor", "first", "bokrom"],
    ["név", "first", "nevem"],
  ];
  it.each(cases)("%s (%s) → %s", (word, person, expected) => {
    expect(owned(word, person)).toBe(expected);
  });
});

describe("hu: several owners", () => {
  it("takes a bare -nk after a vowel", () => {
    expect(owned("alma", "first", true)).toBe("almánk");
    expect(owned("ház", "first", true)).toBe("házunk");
    expect(owned("kert", "first", true)).toBe("kertünk");
  });

  it("harmonizes the second person plural twice over", () => {
    // The linking vowel and the vowel inside the ending agree separately.
    expect(owned("ház", "second", true)).toBe("házatok");
    expect(owned("kert", "second", true)).toBe("kertetek");
    expect(owned("gyümölcs", "second", true)).toBe("gyümölcsötök");
  });

  it("carries the lexical -ja/-je into the third person plural", () => {
    expect(owned("ház", "third", true)).toBe("házuk");
    expect(owned("kert", "third", true)).toBe("kertjük");
  });
});

describe("hu: several things owned", () => {
  const cases: [string, "first" | "second" | "third", boolean, string][] = [
    ["ház", "first", false, "házaim"],
    ["ház", "second", false, "házaid"],
    ["ház", "third", false, "házai"],
    ["ház", "first", true, "házaink"],
    ["ház", "second", true, "házaitok"],
    ["ház", "third", true, "házaik"],
    ["kert", "third", false, "kertjei"],
    ["alma", "third", false, "almái"],
    ["ló", "third", false, "lovai"],
  ];
  it.each(cases)("%s (%s%s) → %s", (word, person, ownerPlural, expected) => {
    expect(owned(word, person, ownerPlural, true)).toBe(expected);
  });
});

describe("hu: the lexical -a/-e versus -ja/-je split", () => {
  it("is learned from the corpus, not guessed", () => {
    // Same shape, opposite choice — only a dictionary can know.
    expect(owned("ház", "third")).toBe("háza");
    expect(owned("kalap", "third")).toBe("kalapja");
    expect(owned("asztal", "third")).toBe("asztala");
    expect(owned("kert", "third")).toBe("kertje");
    expect(owned("táv", "third")).toBe("távja");
  });
});

describe("hu: the essive-formal case (-ként)", () => {
  it("is invariant and takes the plain stem", () => {
    expect(inflect("hu", "tanár", { case: "essiveFormal" })).toBe("tanárként");
    expect(inflect("hu", "alma", { case: "essiveFormal" })).toBe("almaként"); // no lengthening
    expect(inflect("hu", "kéz", { case: "essiveFormal" })).toBe("kézként"); // no shortening
    expect(inflect("hu", "bokor", { case: "essiveFormal" })).toBe("bokorként"); // no fleeting
  });
});

describe("hu: possession through the template layer", () => {
  it("agrees the article with the possessed form", () => {
    expect(format("hu", "^[a {x}](possessor: third) elveszett", { x: "kert" })).toBe(
      "a kertje elveszett",
    );
    expect(format("hu", "^[a {x}](possessor: first) itt van", { x: "alma" })).toBe(
      "az almám itt van",
    );
  });
});
