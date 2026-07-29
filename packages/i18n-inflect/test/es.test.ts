import { describe, expect, it } from "vitest";
import { inflect } from "../src/index.js";
import "../src/es/index.js";
import { pluralize } from "../src/es/index.js";

describe("es: pluralization", () => {
  const cases: [string, string][] = [
    ["carta", "cartas"],
    ["papel", "papeles"],
    ["lápiz", "lápices"],
    ["canción", "canciones"],
    ["francés", "franceses"],
    ["lunes", "lunes"],
    ["crisis", "crisis"],
    ["mes", "meses"],
    ["gas", "gases"],
    ["sofá", "sofás"],
    ["rubí", "rubíes"],
    ["rey", "reyes"],
  ];
  it.each(cases)("%s → %s", (word, expected) => {
    expect(pluralize(word)).toBe(expected);
  });
});

describe("es: articles", () => {
  it("uses el/un before stressed-á feminines in the singular", () => {
    expect(inflect("es", "agua", { article: "definite" })).toBe("el agua");
    expect(inflect("es", "hambre", { article: "definite" })).toBe("el hambre");
    expect(inflect("es", "agua", { article: "indefinite" })).toBe("un agua");
  });

  it("reverts to las in the plural", () => {
    expect(inflect("es", "el agua", { number: "plural" })).toBe("las aguas");
  });

  it("prepends articles by gender (with heuristics)", () => {
    expect(inflect("es", "carta", { article: "definite" })).toBe("la carta");
    expect(inflect("es", "libro", { article: "definite" })).toBe("el libro");
    expect(inflect("es", "problema", { article: "definite" })).toBe("el problema");
    expect(inflect("es", "mano", { article: "definite" })).toBe("la mano");
    expect(inflect("es", "canción", { article: "indefinite" })).toBe("una canción");
  });

  it("re-agrees existing articles for the plural", () => {
    expect(inflect("es", "la carta", { number: "plural" })).toBe("las cartas");
    expect(inflect("es", "un libro", { number: "plural" })).toBe("unos libros");
  });
});
