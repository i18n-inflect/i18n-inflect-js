import { describe, expect, it, vi } from "vitest";
import { format, onWarning, parseTemplate } from "../src/index.js";
import "../src/en/index.js";

describe("parseTemplate", () => {
  it("parses plain text", () => {
    expect(parseTemplate("hello world").nodes).toEqual([{ kind: "text", value: "hello world" }]);
  });

  it("parses variables", () => {
    expect(parseTemplate("hi {name}!").nodes).toEqual([
      { kind: "text", value: "hi " },
      { kind: "var", name: "name" },
      { kind: "text", value: "!" },
    ]);
  });

  it("parses inflection spans with features", () => {
    const t = parseTemplate("^[a card](article: indefinite; number: plural)");
    expect(t.nodes).toEqual([
      {
        kind: "inflect",
        body: [{ kind: "text", value: "a card" }],
        features: { article: "indefinite", number: "plural" },
      },
    ]);
  });

  it("parses variables inside span bodies", () => {
    const t = parseTemplate("^[a {c}](article: indefinite)");
    expect(t.nodes[0]).toMatchObject({
      kind: "inflect",
      body: [
        { kind: "text", value: "a " },
        { kind: "var", name: "c" },
      ],
    });
  });

  it("tolerates a trailing semicolon in features", () => {
    const t = parseTemplate("^[x](case: dative;)");
    expect(t.nodes[0]).toMatchObject({ features: { case: "dative" } });
  });

  it("treats escaped characters as literals", () => {
    expect(parseTemplate("\\^\\[not a span\\]").nodes).toEqual([
      { kind: "text", value: "^[not a span]" },
    ]);
    expect(parseTemplate("\\{brace\\}").nodes).toEqual([{ kind: "text", value: "{brace}" }]);
  });

  it("falls back to literal text on unmatched span syntax", () => {
    expect(parseTemplate("^[dangling").nodes).toEqual([{ kind: "text", value: "^[dangling" }]);
    expect(parseTemplate("^[body] no features").nodes).toEqual([
      { kind: "text", value: "^[body] no features" },
    ]);
    expect(parseTemplate("^[x](not-a-feature-list)").nodes).toEqual([
      { kind: "text", value: "^[x](not-a-feature-list)" },
    ]);
  });

  it("treats a lone { or ^ as literal text", () => {
    expect(parseTemplate("100% {").nodes).toEqual([{ kind: "text", value: "100% {" }]);
    expect(parseTemplate("x ^ y").nodes).toEqual([{ kind: "text", value: "x ^ y" }]);
    expect(parseTemplate("{not ident}").nodes).toEqual([{ kind: "text", value: "{not ident}" }]);
  });
});

describe("format", () => {
  it("interpolates variables outside spans", () => {
    expect(format("en", "hi {name}!", { name: "Ada" })).toBe("hi Ada!");
  });

  it("stringifies numeric arguments", () => {
    expect(format("en", "{n} points", { n: 6 })).toBe("6 points");
  });

  it("leaves missing arguments as literal placeholders and warns", () => {
    const warnings: string[] = [];
    onWarning((w) => warnings.push(w.code));
    expect(format("en", "hi {name}!")).toBe("hi {name}!");
    expect(warnings).toContain("missing-argument");
    onWarning(undefined);
  });

  it("inflects a span after interpolation", () => {
    expect(format("en", "You drew ^[a {c}](article: indefinite)", { c: "ace" })).toBe(
      "You drew an ace",
    );
  });

  it("returns span text unchanged for unknown locales (with a warning)", () => {
    const warn = vi.fn();
    onWarning(warn);
    expect(format("xx", "take ^[a sword](case: dative)")).toBe("take a sword");
    expect(warn).toHaveBeenCalledWith(expect.objectContaining({ code: "unknown-locale" }));
    onWarning(undefined);
  });

  it("ignores unknown feature keys and values with warnings", () => {
    const codes: string[] = [];
    onWarning((w) => codes.push(w.code));
    expect(format("en", "^[a ace](artikel: indefinite)")).toBe("an ace");
    expect(format("en", "^[a ace](article: bogus)")).toBe("an ace");
    expect(codes).toContain("unknown-feature-key");
    expect(codes).toContain("unknown-feature-value");
    onWarning(undefined);
  });

  it("accepts the reserved Apple-compat `inflect: true` annotation", () => {
    expect(format("en", "^[an apple](inflect: true)")).toBe("an apple");
  });

  it("never throws on adversarial input", () => {
    const nasty = [
      "^[",
      "^[]()",
      "^[](",
      "^[a](b:",
      "{",
      "}",
      "\\",
      "^[{x}](case: accusative",
      "^[^[nested](a: b)](c: d)",
      "{} ^[] () ; : \\n",
    ];
    for (const input of nasty) {
      expect(() => format("en", input)).not.toThrow();
      expect(() => format("zz-ZZ", input)).not.toThrow();
    }
  });
});
