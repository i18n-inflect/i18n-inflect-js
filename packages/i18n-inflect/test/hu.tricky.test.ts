import { describe, expect, it } from "vitest";
import "../src/hu/index.js";
import { inflect } from "../src/index.js";

/**
 * A linguist's checklist for Hungarian, written by hand rather than sampled
 * from a corpus.
 *
 * The golden fixtures measure aggregate accuracy over whatever UniMorph
 * happens to contain; this file asserts the specific words that make
 * Hungarian hard, one phenomenon at a time. When a rule regresses, the
 * failing test names the phenomenon instead of a percentage.
 */

const acc = (word: string) => inflect("hu", word, { case: "accusative" });
const ins = (word: string) => inflect("hu", word, { case: "instrumental" });
const plural = (word: string) => inflect("hu", word, { number: "plural" });
const on = (word: string) => inflect("hu", word, { case: "superessive" });
const to = (word: string) => inflect("hu", word, { case: "allative" });

describe("hu: vowel harmony", () => {
  it("picks the suffix from the last non-neutral vowel", () => {
    expect(inflect("hu", "papír", { case: "dative" })).toBe("papírnak");
    expect(inflect("hu", "kávé", { case: "dative" })).toBe("kávénak");
    expect(inflect("hu", "kert", { case: "dative" })).toBe("kertnek");
  });

  it("knows the all-neutral words that are nevertheless back", () => {
    // A closed lexical class: nothing in the spelling predicts it.
    expect(to("híd")).toBe("hídhoz");
    expect(to("cél")).toBe("célhoz");
    expect(to("nyíl")).toBe("nyílhoz");
    expect(to("díj")).toBe("díjhoz");
    // …while ordinary all-neutral words are front.
    expect(to("szív")).toBe("szívhez");
    expect(to("kép")).toBe("képhez");
  });

  it("uses the rounded third form after ö/ő/ü/ű", () => {
    expect(to("föld")).toBe("földhöz");
    expect(to("gyümölcs")).toBe("gyümölcshöz");
    expect(acc("gyümölcs")).toBe("gyümölcsöt");
    expect(on("föld")).toBe("földön");
  });
});

describe("hu: stem alternations", () => {
  it("shortens the stem vowel (kéz → kezet)", () => {
    const cases: [string, string][] = [
      ["kéz", "kezet"],
      ["víz", "vizet"],
      ["tűz", "tüzet"],
      ["út", "utat"],
      ["kút", "kutat"],
      ["madár", "madarat"],
      ["kenyér", "kenyeret"],
      ["levél", "levelet"],
      ["tehén", "tehenet"],
      ["egér", "egeret"],
      ["név", "nevet"],
      ["jég", "jeget"],
    ];
    for (const [word, expected] of cases) expect(acc(word)).toBe(expected);
  });

  it("has to pick one reading for a homonym", () => {
    // Some words are two words. `nyár` is "summer" (nyarat) and "poplar"
    // (nyárat); `szél` is "wind" (szelet) and "edge" (szélt) — and the two
    // readings inflect differently. A function from string to string cannot
    // tell them apart, so whichever the lexicon picked is wrong half the
    // time. Callers who know the sense can seed the oracle with the form
    // they want.
    expect(["nyarat", "nyárat"]).toContain(acc("nyár"));
    expect(["szelet", "szélt"]).toContain(acc("szél"));
  });

  it("keeps the long vowel where the shortening does not apply", () => {
    // The superessive takes the full stem even for shortening words.
    expect(on("víz")).toBe("vízen");
    expect(on("kéz")).toBe("kézen");
    expect(ins("kéz")).toBe("kézzel");
    expect(ins("víz")).toBe("vízzel");
  });

  it("restores v-stems (ló → lovat)", () => {
    const cases: [string, string][] = [
      ["ló", "lovat"],
      ["kő", "követ"],
      ["tó", "tavat"],
      ["fű", "füvet"],
      ["hó", "havat"],
      ["cső", "csövet"],
    ];
    for (const [word, expected] of cases) expect(acc(word)).toBe(expected);
    expect(plural("ló")).toBe("lovak");
    expect(on("ló")).toBe("lovon");
    // …but a v-stem keeps its plain form before consonant-initial suffixes.
    expect(ins("ló")).toBe("lóval");
    expect(to("ló")).toBe("lóhoz");
  });

  it("drops the fleeting vowel (bokor → bokrot)", () => {
    const cases: [string, string][] = [
      ["bokor", "bokrot"],
      ["tükör", "tükröt"],
      ["majom", "majmot"],
      ["álom", "álmot"],
      ["terem", "termet"],
      ["torok", "torkot"],
      ["sarok", "sarkot"],
      ["cukor", "cukrot"],
      ["ökör", "ökröt"],
      ["dolog", "dolgot"],
    ];
    for (const [word, expected] of cases) expect(acc(word)).toBe(expected);
    // …and keeps the full stem before consonant-initial suffixes.
    expect(ins("bokor")).toBe("bokorral");
    expect(inflect("hu", "álom", { case: "inessive" })).toBe("álomban");
  });

  it("lowers the linking vowel where the word demands it", () => {
    const cases: [string, string][] = [
      ["ház", "házat"],
      ["fal", "falat"],
      ["hal", "halat"],
      ["láb", "lábat"],
      ["nyak", "nyakat"],
      ["ág", "ágat"],
      ["toll", "tollat"],
      ["vaj", "vajat"],
      ["tej", "tejet"],
      ["fej", "fejet"],
      ["hely", "helyet"],
      ["föld", "földet"],
      ["fül", "fület"],
    ];
    for (const [word, expected] of cases) expect(acc(word)).toBe(expected);
  });
});

describe("hu: the accusative -t", () => {
  it("attaches bare after l, ly, j, n, ny, r, s, sz, z, zs", () => {
    expect(acc("bor")).toBe("bort");
    expect(acc("pénz")).toBe("pénzt");
    expect(acc("asztal")).toBe("asztalt");
    expect(acc("sör")).toBe("sört");
    expect(acc("busz")).toBe("buszt");
  });

  it("takes a linking vowel elsewhere", () => {
    expect(acc("kert")).toBe("kertet");
    expect(acc("pad")).toBe("padot");
    expect(acc("szék")).toBe("széket");
    expect(acc("hat")).toBe("hatot");
  });

  it("lengthens a final a/e first", () => {
    expect(acc("alma")).toBe("almát");
    expect(acc("medve")).toBe("medvét");
    expect(acc("kutya")).toBe("kutyát");
    expect(acc("kapu")).toBe("kaput"); // …but only a and e lengthen
  });
});

describe("hu: v-assimilation in -val/-vel and -vá/-vé", () => {
  const cases: [string, string][] = [
    ["ház", "házzal"],
    ["ász", "ásszal"],
    ["busz", "busszal"],
    ["gyümölcs", "gyümölccsel"],
    ["toll", "tollal"], // already geminate: no triple letter
    ["könyv", "könyvvel"],
    // Words with an unpronounced final h (méh, cseh, juh) are left out on
    // purpose: the corpus attests méhvel, which contradicts the assimilation
    // rule, and it needs a native speaker to settle.
    ["hajó", "hajóval"], // vowel-final keeps the v
    ["medve", "medvével"],
  ];
  it.each(cases)("%s → %s", (word, expected) => {
    expect(ins(word)).toBe(expected);
  });

  it("assimilates in the translative too", () => {
    expect(inflect("hu", "víz", { case: "translative" })).toBe("vízzé");
    expect(inflect("hu", "só", { case: "translative" })).toBe("sóvá");
  });
});

describe("hu: plural, alone and with a case", () => {
  const cases: [string, string][] = [
    ["ház", "házak"],
    ["szék", "székek"],
    ["gyümölcs", "gyümölcsök"],
    ["alma", "almák"],
    ["kéz", "kezek"],
    ["ló", "lovak"],
    ["bokor", "bokrok"],
    ["híd", "hidak"],
  ];
  it.each(cases)("%s → %s", (word, expected) => {
    expect(plural(word)).toBe(expected);
  });

  it("chains a case onto the plural", () => {
    expect(inflect("hu", "ház", { number: "plural", case: "accusative" })).toBe("házakat");
    expect(inflect("hu", "szék", { number: "plural", case: "accusative" })).toBe("székeket");
    expect(inflect("hu", "gyümölcs", { number: "plural", case: "accusative" })).toBe(
      "gyümölcsöket",
    );
    expect(inflect("hu", "ház", { number: "plural", case: "instrumental" })).toBe("házakkal");
    expect(inflect("hu", "ló", { number: "plural", case: "accusative" })).toBe("lovakat");
  });
});

describe("hu: numbers spelled out to find their suffix", () => {
  const cases: [string, string][] = [
    ["1", "1-gyel"], // egy + vel → eggyel
    ["2", "2-vel"], // kettő
    ["3", "3-mal"], // három
    ["4", "4-gyel"], // négy
    ["5", "5-tel"], // öt
    ["6", "6-tal"], // hat
    ["7", "7-tel"], // hét
    ["8", "8-cal"], // nyolc
    ["9", "9-cel"], // kilenc
    ["10", "10-zel"], // tíz
    ["20", "20-szal"], // húsz
    ["100", "100-zal"], // száz
    ["1000", "1000-rel"], // ezer
  ];
  it.each(cases)("%s + instrumental → %s", (token, expected) => {
    expect(ins(token)).toBe(expected);
  });

  it("takes the accusative from the spoken form too", () => {
    expect(acc("1")).toBe("1-et");
    expect(acc("2")).toBe("2-t");
    expect(acc("3")).toBe("3-at");
    expect(acc("6")).toBe("6-ot");
    expect(acc("10")).toBe("10-et");
    expect(acc("100")).toBe("100-at");
    expect(acc("2026")).toBe("2026-ot"); // …hat
  });
});

describe("hu: initialisms read letter by letter", () => {
  it("suffixes from the letter names", () => {
    expect(acc("SMS")).toBe("SMS-t");
    expect(inflect("hu", "MTA", { case: "inessive" })).toBe("MTA-ban");
    expect(ins("BKV")).toBe("BKV-vel");
    expect(acc("EU")).toBe("EU-t");
  });
});

describe("hu: the definite article follows pronunciation", () => {
  const cases: [string, string][] = [
    ["alma", "az alma"],
    ["ház", "a ház"],
    ["5", "az 5"],
    ["6", "a 6"],
    ["1", "az 1"],
    ["10", "a 10"],
    ["1000", "az 1000"],
    ["MTA", "az MTA"],
    ["SMS", "az SMS"],
    ["BKV", "a BKV"],
  ];
  it.each(cases)("%s → %s", (word, expected) => {
    expect(inflect("hu", word, { article: "definite" })).toBe(expected);
  });
});

describe("hu: compounds versus words that merely look composed", () => {
  it("inherits the final member's behaviour", () => {
    expect(acc("kávéház")).toBe("kávéházat");
    expect(acc("tábortűz")).toBe("tábortüzet");
    expect(acc("forrásvíz")).toBe("forrásvizet");
    expect(plural("fénysugár")).toBe("fénysugarak");
  });

  it("leaves derivations and coincidences alone", () => {
    // -ész is an agent suffix, not the noun ész
    expect(acc("régész")).toBe("régészt");
    // -ér here is part of the word, not the noun ér
    expect(acc("pincér")).toBe("pincért");
    // tartalék is not tarta + lék
    expect(ins("tartalék")).toBe("tartalékkal");
  });
});

describe("hu: the -i relational adjective", () => {
  const cases: [string, string][] = [
    ["Budapest", "budapesti"],
    ["Szeged", "szegedi"],
    ["Győr", "győri"],
    ["Kanada", "kanadai"],
    ["Helsinki", "helsinki"],
    ["Eger", "egri"],
    ["ma", "mai"],
  ];
  it.each(cases)("%s → %s", (word, expected) => {
    expect(inflect("hu", word, { derivation: "relational" })).toBe(expected);
  });
});

describe("hu: proper nouns keep their capital", () => {
  it("suffixes without lowercasing", () => {
    expect(ins("Péter")).toBe("Péterrel");
    expect(inflect("hu", "Budapest", { case: "sublative" })).toBe("Budapestre");
    expect(inflect("hu", "Debrecen", { case: "inessive" })).toBe("Debrecenben");
  });
});
