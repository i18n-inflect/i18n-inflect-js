import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { GrammaticalCase } from "../src/core/features.js";
import "../src/hu/index.js";
import { HU_CASE_TAGS } from "../src/hu/tags.js";
import { inflect } from "../src/index.js";

/**
 * Golden test: held-out UniMorph rows through the *public* API.
 *
 * These lemmas were excluded from lexicon generation, so this measures how
 * the rule engine generalizes to unseen vocabulary. The gate is
 * deliberately below the pipeline's reported held-out accuracy to allow
 * fixture resampling without churn, and well above where regressions live.
 */

const GATE = 0.9;

interface Golden {
  source: string;
  rows: [lemma: string, tag: string, form: string][];
}

const TAG_TO_CASE = new Map<string, GrammaticalCase>(
  (Object.entries(HU_CASE_TAGS) as [GrammaticalCase, string][]).map(([c, t]) => [t, c]),
);

describe("hu: golden held-out accuracy", () => {
  const golden: Golden = JSON.parse(
    readFileSync(new URL("./fixtures/hu.golden.json", import.meta.url), "utf8"),
  );

  it(`reaches ≥ ${GATE * 100}% on ${golden.rows.length} held-out UniMorph rows`, () => {
    let correct = 0;
    const misses: string[] = [];
    for (const [lemma, tag, form] of golden.rows) {
      const [, caseTag, num] = tag.split(";") as [string, string, string];
      const features: Parameters<typeof inflect>[2] = {};
      if (num === "PL") features.number = "plural";
      if (caseTag !== "NOM") features.case = TAG_TO_CASE.get(caseTag) as GrammaticalCase;
      if (inflect("hu", lemma, features) === form) correct++;
      else if (misses.length < 10) misses.push(`${lemma} ${tag}: expected ${form}`);
    }
    const accuracy = correct / golden.rows.length;
    // Surface a few examples when the gate fails, for quick diagnosis.
    expect(misses.length === 0 || accuracy >= GATE, misses.join("\n")).toBe(true);
    expect(accuracy).toBeGreaterThanOrEqual(GATE);
  });
});
