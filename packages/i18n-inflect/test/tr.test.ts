import { describe, expect, it } from "vitest";
import { format, inflect } from "../src/index.js";
import "../src/tr/index.js";
import { highVowel, lowVowel, soften } from "../src/tr/phonology.js";

/**
 * Turkish agreement.
 *
 * Almost everything here is phonology: two harmony systems choose the suffix
 * vowel, a `d` devoices after a voiceless consonant, and the stem's final
 * `p ç t k` voices before a vowel. Only that last one is lexical.
 */

const inf = (word: string, features: Parameters<typeof inflect>[2]) =>
  inflect("tr", word, features);

describe("tr: vowel harmony", () => {
  it("copies backness for the two-way vowel", () => {
    expect(lowVowel("ev")).toBe("e");
    expect(lowVowel("kitap")).toBe("a");
    expect(lowVowel("göz")).toBe("e");
    expect(lowVowel("okul")).toBe("a");
  });

  it("copies backness and rounding for the four-way vowel", () => {
    expect(highVowel("ev")).toBe("i"); // front unrounded
    expect(highVowel("kitap")).toBe("ı"); // back unrounded
    expect(highVowel("okul")).toBe("u"); // back rounded
    expect(highVowel("göz")).toBe("ü"); // front rounded
  });
});

describe("tr: final consonant softening", () => {
  it("voices p ç t k before a vowel", () => {
    expect(soften("kitap")).toBe("kitab");
    expect(soften("ağaç")).toBe("ağac");
    expect(soften("kanat")).toBe("kanad");
    expect(soften("sokak")).toBe("sokağ");
    expect(soften("renk")).toBe("reng"); // nk → ng, not nğ
  });

  it("applies it to the accusative and dative", () => {
    expect(inf("kitap", { case: "accusative" })).toBe("kitabı");
    expect(inf("ağaç", { case: "accusative" })).toBe("ağacı");
  });

  it("respects the words that refuse to soften", () => {
    // Lexical: nothing in the spelling separates kitap from top.
    expect(inf("top", { case: "accusative" })).toBe("topu");
  });

  it("does not soften before a consonant-initial suffix", () => {
    expect(inf("kitap", { case: "inessive" })).toBe("kitapta");
    expect(inf("kitap", { number: "plural" })).toBe("kitaplar");
  });
});

describe("tr: cases", () => {
  const cases: [string, Parameters<typeof inflect>[2], string][] = [
    ["ev", { case: "accusative" }, "evi"],
    ["ev", { case: "dative" }, "eve"],
    ["ev", { case: "inessive" }, "evde"],
    ["ev", { case: "elative" }, "evden"],
    ["ev", { case: "genitive" }, "evin"],
    ["ev", { case: "instrumental" }, "evle"],
    ["okul", { case: "dative" }, "okula"],
    ["göz", { case: "accusative" }, "gözü"],
    ["kitap", { case: "elative" }, "kitaptan"],
  ];
  it.each(cases)("%s + %o → %s", (word, features, expected) => {
    expect(inf(word, features)).toBe(expected);
  });

  it("inserts a buffer consonant after a vowel", () => {
    expect(inf("araba", { case: "accusative" })).toBe("arabayı");
    expect(inf("araba", { case: "dative" })).toBe("arabaya");
    expect(inf("araba", { case: "genitive" })).toBe("arabanın"); // n, not y
    expect(inf("kedi", { case: "genitive" })).toBe("kedinin");
    expect(inf("araba", { case: "instrumental" })).toBe("arabayla");
  });
});

describe("tr: plural, alone and with a case", () => {
  it("harmonizes and then the case harmonizes with it", () => {
    expect(inf("ev", { number: "plural" })).toBe("evler");
    expect(inf("kitap", { number: "plural" })).toBe("kitaplar");
    expect(inf("kitap", { number: "plural", case: "inessive" })).toBe("kitaplarda");
    expect(inf("ev", { number: "plural", case: "dative" })).toBe("evlere");
    expect(inf("göz", { number: "plural", case: "accusative" })).toBe("gözleri");
  });
});

describe("tr: compound nouns whose head is possessed", () => {
  it("puts an -n- between the possessive and the case", () => {
    // `göbek dansı` already carries a third-person possessive, so the case
    // suffix cannot attach directly: dansına, not *dansıya.
    expect(inf("göbek dansı", { case: "dative" })).toBe("göbek dansına");
    expect(inf("cep telefonu", { case: "accusative" })).toBe("cep telefonunu");
    expect(inf("otobüs durağı", { case: "inessive" })).toBe("otobüs durağında");
  });

  it("puts the plural inside the possessive", () => {
    expect(inf("göbek dansı", { number: "plural" })).toBe("göbek dansları");
  });
});

describe("tr: proper nouns take an apostrophe", () => {
  it("separates the name from its suffix", () => {
    expect(inf("İstanbul", { case: "dative" })).toBe("İstanbul'a");
    expect(inf("Ankara", { case: "inessive" })).toBe("Ankara'da");
  });
});

describe("tr: through the template layer", () => {
  it("inflects the interpolated value", () => {
    expect(format("tr", "^[{city}](case: dative) gidiyorum", { city: "İstanbul" })).toBe(
      "İstanbul'a gidiyorum",
    );
    expect(format("tr", "^[{x}](case: accusative) okudum", { x: "kitap" })).toBe("kitabı okudum");
  });
});
