import { describe, expect, it } from "vitest";
import "../src/hu/index.js";
import { inflect } from "../src/index.js";

/**
 * The worked examples from the Hungarian Academy of Sciences' orthography,
 * *A magyar helyesírás szabályai*, 12th edition (AkH. 12.), rule 82 —
 * "A -val, -vel és a -vá, -vé alakmódosulásai".
 *
 * https://helyesiras.mta.hu/helyesiras/default/akh12
 *
 * This is the authority the rules are meant to implement, so its examples
 * are the strongest test material available: every string below is copied
 * from the rule, not invented here.
 */

const ins = (word: string) => inflect("hu", word, { case: "instrumental" });
const tra = (word: string) => inflect("hu", word, { case: "translative" });

describe("AkH. 82. a) after a single short consonant", () => {
  const cases: [string, string][] = [
    ["bot", "bottal"],
    ["cukor", "cukorral"],
    ["kék", "kékkel"],
    ["arany", "arannyal"],
    ["rozs", "rozzsal"],
    ["4", "4-gyel"],
  ];
  it.each(cases)("%s → %s", (word, expected) => expect(ins(word)).toBe(expected));

  const translative: [string, string][] = [
    ["tudós", "tudóssá"],
    ["szén", "szénné"],
    ["víz", "vízzé"],
    ["király", "királlyá"],
    ["özvegy", "özveggyé"],
  ];
  it.each(translative)("%s → %s", (word, expected) => expect(tra(word)).toBe(expected));
});

describe("AkH. 82. b) after a long consonant", () => {
  const cases: [string, string][] = [
    ["jobb", "jobbal"],
    ["toll", "tollal"],
    ["tett", "tettel"],
    ["gally", "gallyal"],
    ["könny", "könnyel"],
    ["meggy", "meggyel"],
  ];
  it.each(cases)("%s → %s", (word, expected) => expect(ins(word)).toBe(expected));
  it("rossz → rosszá", () => expect(tra("rossz")).toBe("rosszá"));
});

describe("AkH. 82. c) after two consonants", () => {
  const cases: [string, string][] = [
    ["hang", "hanggal"],
    ["komp", "komppal"],
    ["mind", "minddel"],
    ["gyöngy", "gyönggyel"],
    ["kulcs", "kulccsal"],
    ["szárny", "szárnnyal"],
  ];
  it.each(cases)("%s → %s", (word, expected) => expect(ins(word)).toBe(expected));

  const translative: [string, string][] = [
    ["füst", "füstté"],
    ["bolond", "bolonddá"],
    ["szilánk", "szilánkká"],
    ["bölcs", "bölccsé"],
    ["rongy", "ronggyá"],
  ];
  it.each(translative)("%s → %s", (word, expected) => expect(tra(word)).toBe(expected));
});

describe("AkH. 82. d) after a final v, both letters are written", () => {
  const cases: [string, string][] = [
    ["hév", "hévvel"],
    ["szív", "szívvel"],
    ["kedv", "kedvvel"],
    ["terv", "tervvel"],
  ];
  it.each(cases)("%s → %s", (word, expected) => expect(ins(word)).toBe(expected));

  const translative: [string, string][] = [
    ["név", "névvé"],
    ["sav", "savvá"],
    ["könyv", "könyvvé"],
    ["nedv", "nedvvé"],
  ];
  it.each(translative)("%s → %s", (word, expected) => expect(tra(word)).toBe(expected));
});

describe("AkH. 82. e) nouns with a fluctuating final h", () => {
  it("writes the unassimilated form, which the rule allows alongside the other", () => {
    // The rule permits both dühvel and dühhel, méhvé and méhhé. One of them
    // has to be the default; the unassimilated one keeps the word readable.
    expect(ins("düh")).toBe("dühvel");
    expect(ins("méh")).toBe("méhvel");
    expect(tra("méh")).toBe("méhvé");
    expect(ins("cseh")).toBe("csehvel");
  });
});

describe("AkH. 82. f) after digits, symbols, abbreviations and initialisms", () => {
  it("writes the assimilated consonant after the hyphen", () => {
    expect(ins("4")).toBe("4-gyel");
    expect(ins("15%")).toBe("15%-kal");
    expect(ins("DNS")).toBe("DNS-sel");
  });
});
