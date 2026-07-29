import { beforeEach, describe, expect, it, vi } from "vitest";
import { LruCache } from "../src/core/cache.js";
import type { FallbackRequest, InflectionContext, LanguagePack } from "../src/core/pack.js";
import {
  clearOracle,
  inflect,
  inflectAsync,
  registerFallback,
  registerLanguage,
  resetRegistry,
  resolveLocale,
  seedOracle,
} from "../src/index.js";

describe("LruCache", () => {
  it("evicts the least recently used entry", () => {
    const cache = new LruCache<string, number>(2);
    cache.set("a", 1);
    cache.set("b", 2);
    cache.get("a"); // refresh "a"
    cache.set("c", 3); // evicts "b"
    expect(cache.has("a")).toBe(true);
    expect(cache.has("b")).toBe(false);
    expect(cache.has("c")).toBe(true);
  });
});

describe("resolveLocale", () => {
  it("reduces BCP 47 tags to the primary subtag", () => {
    expect(resolveLocale("hu-HU")).toBe("hu");
    expect(resolveLocale("en_US")).toBe("en");
    expect(resolveLocale("KO")).toBe("ko");
  });
});

/**
 * A minimal pack exercising the oracle protocol: it inflects `word` via
 * `ctx.lookup` and falls back to `word + "?"` while requesting a fallback.
 */
const oraclePack: LanguagePack = {
  locale: "zz",
  inflectPhrase(phrase, _features, ctx: InflectionContext) {
    const request: FallbackRequest = { lemma: phrase, tag: "N;ACC;SG" };
    const cached = ctx.lookup(request);
    if (cached) return { text: cached, confidence: "high" };
    ctx.requestFallback(request);
    return { text: `${phrase}?`, confidence: "low" };
  },
};

describe("two-pass async engine", () => {
  beforeEach(() => {
    resetRegistry();
    clearOracle();
    registerLanguage(oraclePack);
  });

  it("sync inflect returns the rule-based guess", () => {
    expect(inflect("zz", "alma")).toBe("alma?");
  });

  it("inflectAsync without a fallback returns the sync answer", async () => {
    await expect(inflectAsync("zz", "alma")).resolves.toBe("alma?");
  });

  it("inflectAsync consults the fallback and re-runs the pack", async () => {
    const predict = vi.fn(async (reqs: readonly FallbackRequest[]) =>
      reqs.map((r) => `${r.lemma}t`),
    );
    registerFallback({ locale: "zz", predict });
    await expect(inflectAsync("zz", "alma")).resolves.toBe("almat");
    expect(predict).toHaveBeenCalledOnce();
    expect(predict.mock.calls[0]?.[0]).toEqual([{ lemma: "alma", tag: "N;ACC;SG" }]);
  });

  it("caches fallback answers so later sync calls are corrected", async () => {
    registerFallback({
      locale: "zz",
      predict: async (reqs) => reqs.map((r) => `${r.lemma}t`),
    });
    expect(inflect("zz", "alma")).toBe("alma?"); // before: rules only
    await inflectAsync("zz", "alma");
    expect(inflect("zz", "alma")).toBe("almat"); // after: cache upgraded
  });

  it("does not re-ask the fallback for cached answers", async () => {
    const predict = vi.fn(async (reqs: readonly FallbackRequest[]) =>
      reqs.map((r) => `${r.lemma}t`),
    );
    registerFallback({ locale: "zz", predict });
    await inflectAsync("zz", "alma");
    await inflectAsync("zz", "alma");
    expect(predict).toHaveBeenCalledOnce();
  });

  it("survives a fallback failure and keeps the sync answer", async () => {
    registerFallback({
      locale: "zz",
      predict: async () => {
        throw new Error("model exploded");
      },
    });
    await expect(inflectAsync("zz", "alma")).resolves.toBe("alma?");
  });

  it("ignores empty fallback answers", async () => {
    registerFallback({ locale: "zz", predict: async (reqs) => reqs.map(() => "") });
    await expect(inflectAsync("zz", "alma")).resolves.toBe("alma?");
  });

  it("seedOracle upgrades sync answers directly", () => {
    seedOracle("zz", { lemma: "alma", tag: "N;ACC;SG" }, "almát");
    expect(inflect("zz", "alma")).toBe("almát");
  });

  it("packs behave deterministically for identical input + cache state", () => {
    const a = inflect("zz", "körte");
    const b = inflect("zz", "körte");
    expect(a).toBe(b);
  });

  it("unknown locale passes phrases through unchanged", () => {
    expect(inflect("yy", "unchanged")).toBe("unchanged");
  });
});
