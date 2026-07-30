import { beforeEach, describe, expect, it, vi } from "vitest";
import { definiteArticle } from "../src/hu/article.js";
import {
  clearOracle,
  format,
  inflect,
  inflectAsync,
  registerFallback,
  seedOracle,
} from "../src/index.js";
import "../src/hu/index.js";
import { STEM_FLAGS } from "../src/hu/exceptions.gen.js";
import { attachAssimilating, lengthenFinalVowel } from "../src/hu/orthography.js";
import { finalConsonantOf, harmonyOf, hasRoundedFinalVowel } from "../src/hu/phonology.js";
import { inflectNounRules } from "../src/hu/suffixes.js";

describe("hu: phonology", () => {
  it("classifies two-form harmony", () => {
    expect(harmonyOf("ház")).toBe("back");
    expect(harmonyOf("kert")).toBe("front");
    expect(harmonyOf("tükör")).toBe("front");
    expect(harmonyOf("papír")).toBe("back"); // neutral í is transparent
    expect(harmonyOf("kávé")).toBe("back"); // é transparent, á decides
    expect(harmonyOf("víz")).toBe("front"); // all-neutral defaults to front
    expect(harmonyOf("híd")).toBe("back"); // classic back exception
    expect(harmonyOf("cél")).toBe("back");
  });

  it("detects rounded final vowels", () => {
    expect(hasRoundedFinalVowel("gyümölcs")).toBe(true);
    expect(hasRoundedFinalVowel("föld")).toBe(true);
    expect(hasRoundedFinalVowel("kert")).toBe(false);
  });

  it("finds final consonant graphemes with gemination", () => {
    expect(finalConsonantOf("ház")).toEqual({ grapheme: "z", geminate: false });
    expect(finalConsonantOf("ász")).toEqual({ grapheme: "sz", geminate: false });
    expect(finalConsonantOf("toll")).toEqual({ grapheme: "l", geminate: true });
    expect(finalConsonantOf("hossz")).toEqual({ grapheme: "sz", geminate: true });
    expect(finalConsonantOf("alma")).toBeUndefined();
  });
});

describe("hu: orthography", () => {
  it("lengthens final a/e", () => {
    expect(lengthenFinalVowel("fa")).toBe("fá");
    expect(lengthenFinalVowel("medve")).toBe("medvé");
    expect(lengthenFinalVowel("hajó")).toBe("hajó");
  });

  it("assimilates v-suffixes with written gemination", () => {
    expect(attachAssimilating("ház", "al")).toBe("házzal");
    expect(attachAssimilating("ász", "al")).toBe("ásszal");
    expect(attachAssimilating("busz", "al")).toBe("busszal");
    expect(attachAssimilating("gyümölcs", "el")).toBe("gyümölccsel");
    expect(attachAssimilating("toll", "al")).toBe("tollal");
    expect(attachAssimilating("víz", "é")).toBe("vízzé");
  });
});

describe("hu: noun suffix engine", () => {
  const flagsOf = (lemma: string) => STEM_FLAGS.get(lemma);
  const rule = (
    lemma: string,
    huCase: Parameters<typeof inflectNounRules>[3],
    plural = false,
  ): string => inflectNounRules(lemma, flagsOf(lemma), plural, huCase);

  it("accusative", () => {
    expect(rule("alma", "accusative")).toBe("almát");
    expect(rule("medve", "accusative")).toBe("medvét");
    expect(rule("kapu", "accusative")).toBe("kaput");
    expect(rule("ház", "accusative")).toBe("házat");
    expect(rule("szék", "accusative")).toBe("széket");
    expect(rule("gyümölcs", "accusative")).toBe("gyümölcsöt");
    expect(rule("bor", "accusative")).toBe("bort");
    expect(rule("pénz", "accusative")).toBe("pénzt");
    expect(rule("asztal", "accusative")).toBe("asztalt");
    expect(rule("fal", "accusative")).toBe("falat");
    expect(rule("fül", "accusative")).toBe("fület");
    expect(rule("hely", "accusative")).toBe("helyet");
    expect(rule("kéz", "accusative")).toBe("kezet");
    expect(rule("víz", "accusative")).toBe("vizet");
    expect(rule("út", "accusative")).toBe("utat");
    expect(rule("híd", "accusative")).toBe("hidat");
    expect(rule("ló", "accusative")).toBe("lovat");
    expect(rule("kő", "accusative")).toBe("követ");
    expect(rule("bokor", "accusative")).toBe("bokrot");
    expect(rule("tükör", "accusative")).toBe("tükröt");
    expect(rule("sátor", "accusative")).toBe("sátrat");
    expect(rule("föld", "accusative")).toBe("földet");
    expect(rule("hat", "accusative")).toBe("hatot");
  });

  it("plural", () => {
    expect(rule("ház", undefined, true)).toBe("házak");
    expect(rule("szék", undefined, true)).toBe("székek");
    expect(rule("gyümölcs", undefined, true)).toBe("gyümölcsök");
    expect(rule("alma", undefined, true)).toBe("almák");
    expect(rule("kéz", undefined, true)).toBe("kezek");
    expect(rule("ló", undefined, true)).toBe("lovak");
    expect(rule("bokor", undefined, true)).toBe("bokrok");
    expect(rule("híd", undefined, true)).toBe("hidak");
  });

  it("plural + case chains", () => {
    expect(rule("ház", "accusative", true)).toBe("házakat");
    expect(rule("szék", "accusative", true)).toBe("székeket");
    expect(rule("gyümölcs", "accusative", true)).toBe("gyümölcsöket");
    expect(rule("ház", "dative", true)).toBe("házaknak");
    expect(rule("ház", "instrumental", true)).toBe("házakkal");
    expect(rule("ház", "superessive", true)).toBe("házakon");
    expect(rule("alma", "accusative", true)).toBe("almákat");
  });

  it("instrumental and translative with assimilation", () => {
    expect(rule("hajó", "instrumental")).toBe("hajóval");
    expect(rule("medve", "instrumental")).toBe("medvével");
    expect(rule("ház", "instrumental")).toBe("házzal");
    expect(rule("busz", "instrumental")).toBe("busszal");
    expect(rule("toll", "instrumental")).toBe("tollal");
    expect(rule("kéz", "instrumental")).toBe("kézzel");
    expect(rule("ló", "instrumental")).toBe("lóval");
    expect(rule("só", "translative")).toBe("sóvá");
    expect(rule("víz", "translative")).toBe("vízzé");
  });

  it("dative, locatives, allative, superessive", () => {
    expect(rule("ház", "dative")).toBe("háznak");
    expect(rule("szék", "dative")).toBe("széknek");
    expect(rule("híd", "dative")).toBe("hídnak");
    expect(rule("alma", "inessive")).toBe("almában");
    expect(rule("ház", "inessive")).toBe("házban");
    expect(rule("ház", "elative")).toBe("házból");
    expect(rule("ház", "illative")).toBe("házba");
    expect(rule("ház", "adessive")).toBe("háznál");
    expect(rule("ház", "ablative")).toBe("háztól");
    expect(rule("ház", "delative")).toBe("házról");
    expect(rule("ház", "sublative")).toBe("házra");
    expect(rule("ház", "allative")).toBe("házhoz");
    expect(rule("szék", "allative")).toBe("székhez");
    expect(rule("föld", "allative")).toBe("földhöz");
    expect(rule("híd", "allative")).toBe("hídhoz");
    expect(rule("ház", "superessive")).toBe("házon");
    expect(rule("kert", "superessive")).toBe("kerten");
    expect(rule("föld", "superessive")).toBe("földön");
    expect(rule("hajó", "superessive")).toBe("hajón");
    expect(rule("víz", "superessive")).toBe("vízen");
    expect(rule("út", "superessive")).toBe("úton");
    expect(rule("ló", "superessive")).toBe("lovon");
    expect(rule("bokor", "superessive")).toBe("bokron");
    expect(rule("ház", "causalFinal")).toBe("házért");
    expect(rule("alma", "causalFinal")).toBe("almáért");
    expect(rule("ház", "terminative")).toBe("házig");
    expect(rule("alma", "terminative")).toBe("almáig");
  });
});

describe("hu: definite article a/az", () => {
  const cases: [string, "a" | "az"][] = [
    ["alma", "az"],
    ["ház", "a"],
    ["ötös", "az"],
    ["Ászok", "az"],
    ["5", "az"],
    ["6", "a"],
    ["50", "az"],
    ["10", "a"],
    ["18", "a"],
    ["100", "a"],
    ["1000", "az"],
    ["10000", "a"],
    ["1000000", "az"],
    ["1", "az"],
    ["2", "a"],
    ["8", "a"],
    ["MTA", "az"],
    ["SMS", "az"],
    ["FTC", "az"],
    ["BKV", "a"],
    ["HÉV", "a"],
    ["X", "az"],
    ["B", "a"],
    ["€", "az"],
    ["$", "a"],
    ["%", "a"],
  ];
  it.each(cases)("%s → %s", (word, expected) => {
    expect(definiteArticle(word)).toBe(expected);
  });
});

describe("hu: phrase-level inflection", () => {
  it("the flagship example: kőr ász instrumental", () => {
    expect(format("hu", "Nyertél ^[a {card}](case: instrumental)!", { card: "kőr ász" })).toBe(
      "Nyertél a kőr ásszal!",
    );
  });

  it("inflects numbers written as words", () => {
    expect(format("hu", "^[a {n}](case: accusative) dobtad", { n: "hat" })).toBe("a hatot dobtad");
  });

  it("re-agrees the article with the inflected head", () => {
    expect(inflect("hu", "az alma", { case: "accusative" })).toBe("az almát");
    expect(inflect("hu", "a alma", { case: "accusative" })).toBe("az almát");
    expect(inflect("hu", "az ház")).toBe("a ház");
  });

  it("keeps article capitalization", () => {
    expect(format("hu", "^[A {x}](case: dative)", { x: "alma" })).toBe("Az almának");
  });

  it("prepends articles on request", () => {
    expect(inflect("hu", "alma", { article: "definite" })).toBe("az alma");
    expect(inflect("hu", "ház", { article: "definite" })).toBe("a ház");
    expect(inflect("hu", "alma", { article: "indefinite" })).toBe("egy alma");
    expect(inflect("hu", "az alma", { article: "none" })).toBe("alma");
  });

  it("inflects proper nouns preserving capitalization", () => {
    expect(inflect("hu", "Péter", { case: "instrumental" })).toBe("Péterrel");
    expect(inflect("hu", "Budapest", { case: "sublative" })).toBe("Budapestre");
  });

  it("supports plural + case through the template layer", () => {
    expect(format("hu", "^[a ház](number: plural; case: inessive)")).toBe("a házakban");
  });

  it("uses lexicon overrides where rules fail", () => {
    expect(inflect("hu", "szó", { case: "accusative" })).toBe("szót");
    expect(inflect("hu", "szó", { number: "plural" })).toBe("szavak");
  });
});

describe("hu: oracle protocol for digits/acronyms and unknown words", () => {
  beforeEach(() => clearOracle());

  it("suffixes digits by rules, no oracle needed", () => {
    // Numerals are a closed class spelled out by numerals.ts, so this needs
    // neither the lexicon nor a model.
    expect(inflect("hu", "a 6", { case: "accusative" })).toBe("a 6-ot");
  });

  it("leaves tokens it cannot read unchanged, but accepts oracle answers", () => {
    expect(inflect("hu", "a 6-os", { case: "accusative" })).toBe("a 6-os");
    seedOracle("hu", { lemma: "6-os", tag: "N;ACC;SG" }, "6-osat");
    expect(inflect("hu", "a 6-os", { case: "accusative" })).toBe("a 6-osat");
  });

  it("requests fallback for suspicious foreign words", async () => {
    const predict = vi.fn(async (reqs: readonly { lemma: string; tag: string }[]) =>
      reqs.map((r) => `${r.lemma}ot`),
    );
    registerFallback({ locale: "hu", predict });
    const result = await inflectAsync("hu", "qwertyx", { case: "accusative" });
    expect(predict).toHaveBeenCalledOnce();
    expect(result).toBe("qwertyxot");
  });
});
