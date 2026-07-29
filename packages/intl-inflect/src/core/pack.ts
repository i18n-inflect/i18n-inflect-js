import type { GrammaticalFeatures } from "./features.js";
import type { WarningCode } from "./warnings.js";

/**
 * A single word-level inflection request that rules could not answer with
 * certainty — the unit of work handed to a registered fallback (typically
 * the neural module).
 */
export interface FallbackRequest {
  /** The surface word to inflect (post-interpolation, as seen in the text). */
  lemma: string;
  /**
   * UniMorph-style tag bundle identifying the requested form, e.g.
   * `"N;INS;SG"`. Each pack owns its own tag mapping; core treats the tag as
   * an opaque cache-key component.
   */
  tag: string;
}

/**
 * Capabilities the engine hands to a pack for one `inflectPhrase` run.
 *
 * This is the pack's only side channel: packs must stay pure, deterministic
 * functions of `(phrase, features, lookup results)` — the property the
 * engine's two-pass async design relies on.
 */
export interface InflectionContext {
  /** Resolved primary language subtag ("hu", "de", …). */
  readonly locale: string;
  /**
   * Synchronously consult the shared oracle cache (earlier neural answers).
   * Returns the cached inflected form, or `undefined` on a miss.
   */
  lookup(request: FallbackRequest): string | undefined;
  /**
   * Record that `lookup` missed and a fallback answer would improve the
   * result. The async engine batches these, resolves them via the registered
   * fallback, fills the cache and re-runs the pack.
   */
  requestFallback(request: FallbackRequest): void;
  /** Report a degradation (unknown feature, missing gender, …). */
  warn(code: WarningCode, detail: string): void;
}

/** Outcome of a phrase inflection. */
export interface InflectionResult {
  /** The inflected phrase. */
  text: string;
  /**
   * `"high"` — rules/lexicon were sufficient; `"low"` — a heuristic guess
   * was involved and an async fallback pass may improve the result.
   */
  confidence: "high" | "low";
}

/**
 * The contract a language module implements.
 *
 * A pack works on a whole noun phrase: it tokenizes, inflects the head,
 * agrees articles/adjectives or attaches particles — whatever the language
 * needs. Packs are registered via `registerLanguage`, which importing the
 * language subpath (`import "intl-inflect/hu"`) does as a side effect.
 */
export interface LanguagePack {
  /** Primary language subtag this pack serves ("hu", "de", …). */
  readonly locale: string;
  /**
   * Inflect a phrase according to `features`.
   *
   * Must be pure and synchronous; use `ctx.lookup`/`ctx.requestFallback`
   * for anything beyond deterministic rules.
   */
  inflectPhrase(
    phrase: string,
    features: GrammaticalFeatures,
    ctx: InflectionContext,
  ): InflectionResult;
  /**
   * Optional locale-specific mapping of raw template annotations to
   * {@link GrammaticalFeatures}; defaults to the shared `normalizeFeatures`.
   */
  normalizeFeatures?(
    raw: Record<string, string>,
    warn: (kind: "unknown-feature-key" | "unknown-feature-value", detail: string) => void,
  ): GrammaticalFeatures;
  /**
   * Optional plausibility check for a fallback's answer, called before it
   * enters the shared cache.
   *
   * A fallback is a statistical model asked about words it may never have
   * seen; without a check, one implausible answer would be cached and then
   * served to every later synchronous call. Return `false` to discard it
   * and keep the rule-based form. Core applies generic sanity checks
   * (non-empty, sane length) regardless.
   */
  acceptFallback?(request: FallbackRequest, answer: string): boolean;
}

/**
 * A pluggable oracle that can answer {@link FallbackRequest}s asynchronously —
 * in practice the `@intl-inflect/neural` seq2seq module, but any
 * implementation (server API, bigger dictionary, …) fits.
 */
export interface InflectionFallback {
  /** Primary language subtag this fallback serves. */
  readonly locale: string;
  /**
   * Resolve a batch of requests. Must return one answer per request, in
   * order. Individual answers may be empty strings to signal "no answer".
   */
  predict(requests: readonly FallbackRequest[]): Promise<string[]>;
  /** Optional warm-up (e.g. create the inference session, load weights). */
  preload?(): Promise<void>;
}
