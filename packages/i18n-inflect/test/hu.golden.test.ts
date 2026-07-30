import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { GrammaticalCase } from "../src/core/features.js";
import "../src/hu/index.js";
import { HU_CASE_TAGS } from "../src/hu/tags.js";
import { inflect } from "../src/index.js";

/**
 * Golden test: UniMorph rows through the *public* API.
 *
 * The shipped lexicon covers all of UniMorph, so this grades the vocabulary
 * users actually get rather than generalization — it is the regression net
 * for rules, lexicon and pipeline together. Generalization to words the
 * lexicon has never seen is measured separately by the pipeline, which
 * builds a training-only lexicon for the purpose.
 *
 * Free variation is real: `olaj` takes both `olajok` and `olajak`, so any
 * attested form counts.
 */

const GATE = 0.99;

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

  it(`reaches ≥ ${GATE * 100}% on the UniMorph vocabulary`, () => {
    // Group first: one lemma+tag may have several attested forms.
    const attested = new Map<string, string[]>();
    for (const [lemma, tag, form] of golden.rows) {
      const key = `${lemma}|${tag}`;
      const forms = attested.get(key);
      if (forms) forms.push(form);
      else attested.set(key, [form]);
    }

    let correct = 0;
    const misses: string[] = [];
    for (const [key, forms] of attested) {
      const [lemma, tag] = key.split("|") as [string, string];
      const [, caseTag, num] = tag.split(";") as [string, string, string];
      const features: Parameters<typeof inflect>[2] = {};
      if (num === "PL") features.number = "plural";
      if (caseTag !== "NOM") features.case = TAG_TO_CASE.get(caseTag) as GrammaticalCase;
      if (forms.includes(inflect("hu", lemma, features))) correct++;
      else if (misses.length < 10) misses.push(`${lemma} ${tag}: expected ${forms.join(" / ")}`);
    }
    const accuracy = correct / attested.size;
    // Surface a few examples when the gate fails, for quick diagnosis.
    expect(misses.length === 0 || accuracy >= GATE, misses.join("\n")).toBe(true);
    expect(accuracy).toBeGreaterThanOrEqual(GATE);
  });
});
