import { describe, expect, it } from "vitest";
import { format, inflect } from "../src/index.js";
import { finalSoundOf } from "../src/ko/hangul.js";
import "../src/ko/index.js";

describe("ko: hangul analysis", () => {
  it("detects batchim", () => {
    expect(finalSoundOf("사과")).toEqual({ hasBatchim: false, isRieul: false });
    expect(finalSoundOf("책")).toEqual({ hasBatchim: true, isRieul: false });
    expect(finalSoundOf("서울")).toEqual({ hasBatchim: true, isRieul: true });
  });

  it("reads digits in Korean", () => {
    expect(finalSoundOf("8")).toEqual({ hasBatchim: true, isRieul: true }); // 팔
    expect(finalSoundOf("3")).toEqual({ hasBatchim: true, isRieul: false }); // 삼
    expect(finalSoundOf("2")).toEqual({ hasBatchim: false, isRieul: false }); // 이
  });

  it("returns undefined for undecidable finals", () => {
    expect(finalSoundOf("Chrome")).toBeUndefined();
  });
});

describe("ko: particle attachment", () => {
  const cases: [string, Parameters<typeof inflect>[2], string][] = [
    ["사과", { case: "accusative" }, "사과를"],
    ["책", { case: "accusative" }, "책을"],
    ["사과", { case: "nominative" }, "사과가"],
    ["책", { case: "nominative" }, "책이"],
    ["사과", { case: "topic" }, "사과는"],
    ["책", { case: "topic" }, "책은"],
    ["사과", { case: "comitative" }, "사과와"],
    ["책", { case: "comitative" }, "책과"],
    ["버스", { case: "instrumental" }, "버스로"],
    ["연필", { case: "instrumental" }, "연필로"], // ㄹ final → 로
    ["집", { case: "instrumental" }, "집으로"],
    ["책", { case: "genitive" }, "책의"],
    ["8", { case: "instrumental" }, "8로"], // 팔 → ㄹ
    ["3", { case: "instrumental" }, "3으로"], // 삼
  ];
  it.each(cases)("%s + %o → %s", (phrase, features, expected) => {
    expect(inflect("ko", phrase, features)).toBe(expected);
  });

  it("attaches to the whole phrase", () => {
    expect(inflect("ko", "제주 사과", { case: "accusative" })).toBe("제주 사과를");
  });

  it("uses paired forms for undecidable finals", () => {
    expect(inflect("ko", "Chrome", { case: "accusative" })).toBe("Chrome을(를)");
  });

  it("keeps trailing punctuation outside the particle", () => {
    expect(format("ko", "^[{app}](case: topic) 최고!", { app: "지도" })).toBe("지도는 최고!");
  });

  it("applies the optional plural marker before the particle", () => {
    expect(inflect("ko", "책", { number: "plural", case: "accusative" })).toBe("책들을");
  });
});
