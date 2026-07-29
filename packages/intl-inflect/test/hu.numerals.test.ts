import { beforeEach, describe, expect, it, vi } from "vitest";
import "../src/hu/index.js";
import { hu } from "../src/hu/index.js";
import { hyphenatedForm, numeralTail, spokenTailOf } from "../src/hu/numerals.js";
import {
  clearOracle,
  format,
  inflect,
  inflectAsync,
  onWarning,
  registerFallback,
  resetRegistry,
} from "../src/index.js";

describe("hu: number spelling (final constituent only)", () => {
  const cases: [string, string][] = [
    ["0", "nulla"],
    ["1", "egy"],
    ["2", "kettő"],
    ["6", "hat"],
    ["7", "hét"],
    ["10", "tíz"],
    ["20", "húsz"],
    ["50", "ötven"],
    ["18", "nyolc"],
    ["100", "száz"],
    ["500", "száz"],
    ["1000", "ezer"],
    ["10000", "ezer"],
    ["100000", "ezer"],
    ["1000000", "millió"],
    ["1000000000", "milliárd"],
    ["2026", "hat"],
    ["1500", "száz"],
    ["007", "hét"],
  ];
  it.each(cases)("%s → %s", (digits, expected) => {
    expect(numeralTail(digits)).toBe(expected);
  });

  it("rejects non-digit tokens", () => {
    expect(numeralTail("6-os")).toBeUndefined();
    expect(numeralTail("alma")).toBeUndefined();
  });
});

describe("hu: letter names for initialisms", () => {
  it("reads the final letter", () => {
    expect(spokenTailOf("SMS")).toBe("es");
    expect(spokenTailOf("MTA")).toBe("á");
    expect(spokenTailOf("BKV")).toBe("vé");
    expect(spokenTailOf("FBI")).toBe("i");
  });

  it("ignores ordinary words", () => {
    expect(spokenTailOf("alma")).toBeUndefined();
    expect(spokenTailOf("Budapest")).toBeUndefined();
  });
});

describe("hu: hyphenated suffixes for digits", () => {
  const cases: [string, Parameters<typeof hyphenatedForm>[2], string][] = [
    ["6", "accusative", "6-ot"],
    ["5", "accusative", "5-öt"],
    ["1", "accusative", "1-et"],
    ["2", "accusative", "2-t"],
    ["3", "accusative", "3-at"],
    ["7", "accusative", "7-et"],
    ["8", "accusative", "8-at"],
    ["10", "accusative", "10-et"],
    ["20", "accusative", "20-at"],
    ["50", "accusative", "50-et"],
    ["100", "accusative", "100-at"],
    ["1000", "accusative", "1000-et"],
    // v-assimilation: the doubled grapheme belongs to the written suffix.
    ["6", "instrumental", "6-tal"],
    ["5", "instrumental", "5-tel"],
    ["1", "instrumental", "1-gyel"],
    ["2", "instrumental", "2-vel"],
    ["100", "instrumental", "100-zal"],
    ["1000", "instrumental", "1000-rel"],
    ["4", "instrumental", "4-gyel"],
    // other cases
    ["6", "dative", "6-nak"],
    ["5", "dative", "5-nek"],
    ["6", "inessive", "6-ban"],
    ["6", "sublative", "6-ra"],
    ["5", "allative", "5-höz"],
    ["6", "allative", "6-hoz"],
    ["6", "superessive", "6-on"],
    ["1000000", "instrumental", "1000000-val"],
  ];
  it.each(cases)("%s + %s → %s", (token, huCase, expected) => {
    expect(hyphenatedForm(token, false, huCase)).toBe(expected);
  });

  it("handles plurals and plural + case", () => {
    expect(hyphenatedForm("6", true, undefined)).toBe("6-ok");
    expect(hyphenatedForm("6", true, "accusative")).toBe("6-okat");
    expect(hyphenatedForm("5", true, "accusative")).toBe("5-öket");
  });

  it("returns the bare token when nothing is requested", () => {
    expect(hyphenatedForm("6", false, undefined)).toBe("6");
  });
});

describe("hu: hyphenated suffixes for initialisms", () => {
  const cases: [string, Parameters<typeof hyphenatedForm>[2], string][] = [
    ["SMS", "accusative", "SMS-t"],
    ["MTA", "accusative", "MTA-t"],
    ["MTA", "inessive", "MTA-ban"],
    ["MTA", "instrumental", "MTA-val"],
    ["BKV", "accusative", "BKV-t"],
    ["BKV", "instrumental", "BKV-vel"],
    ["SMS", "instrumental", "SMS-sel"],
  ];
  it.each(cases)("%s + %s → %s", (token, huCase, expected) => {
    expect(hyphenatedForm(token, false, huCase)).toBe(expected);
  });
});

describe("hu: digits and initialisms through the public API", () => {
  it("inflects them inside phrases, with the article agreeing", () => {
    expect(format("hu", "^[a {n}](case: accusative) dobtad", { n: "6" })).toBe("a 6-ot dobtad");
    expect(format("hu", "^[a {n}](case: accusative) dobtad", { n: "5" })).toBe("az 5-öt dobtad");
    expect(inflect("hu", "a 100", { case: "instrumental" })).toBe("a 100-zal");
    expect(inflect("hu", "az MTA", { case: "inessive" })).toBe("az MTA-ban");
  });

  it("needs no fallback for them", async () => {
    resetRegistry();
    clearOracle();
    const { registerLanguage } = await import("../src/index.js");
    registerLanguage(hu);
    const predict = vi.fn(async (reqs: readonly unknown[]) => reqs.map(() => "GARBAGE"));
    registerFallback({ locale: "hu", predict });
    await expect(inflectAsync("hu", "a 6", { case: "accusative" })).resolves.toBe("a 6-ot");
    expect(predict).not.toHaveBeenCalled();
  });
});

describe("hu: fallback answers are validated before being cached", () => {
  beforeEach(async () => {
    resetRegistry();
    clearOracle();
    const { registerLanguage } = await import("../src/index.js");
    registerLanguage(hu);
  });

  it("discards answers that do not start like the lemma", async () => {
    const warnings: string[] = [];
    onWarning((w) => warnings.push(w.code));
    // "6-os" is a token the speller cannot read, so a fallback is consulted.
    registerFallback({ locale: "hu", predict: async () => ["okotat"] });
    const result = await inflectAsync("hu", "6-os", { case: "accusative" });
    expect(result).toBe("6-os"); // unchanged, not poisoned
    expect(inflect("hu", "6-os", { case: "accusative" })).toBe("6-os"); // cache clean
    expect(warnings).toContain("fallback-rejected");
    onWarning(undefined);
  });

  it("discards implausibly long answers", async () => {
    registerFallback({
      locale: "hu",
      predict: async () => ["6-osaaaaaaaaaaaaaaaaaaaaaaa"],
    });
    await expect(inflectAsync("hu", "6-os", { case: "accusative" })).resolves.toBe("6-os");
  });

  it("accepts plausible answers, including stem alternations", async () => {
    registerFallback({ locale: "hu", predict: async () => ["6-osat"] });
    await expect(inflectAsync("hu", "6-os", { case: "accusative" })).resolves.toBe("6-osat");
  });

  it("accepts answers whose stem alternates (kéz → kezet)", () => {
    expect(hu.acceptFallback?.({ lemma: "kéz", tag: "N;ACC;SG" }, "kezet")).toBe(true);
    expect(hu.acceptFallback?.({ lemma: "ló", tag: "N;ACC;SG" }, "lovat")).toBe(true);
    expect(hu.acceptFallback?.({ lemma: "6", tag: "N;ACC;SG" }, "okat")).toBe(false);
    expect(hu.acceptFallback?.({ lemma: "SMS", tag: "N;ACC;SG" }, "okotat")).toBe(false);
  });
});
