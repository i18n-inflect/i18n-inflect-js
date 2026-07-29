import { LruCache } from "./cache.js";
import { type GrammaticalFeatures, normalizeFeatures } from "./features.js";
import type { FallbackRequest, InflectionContext, LanguagePack } from "./pack.js";
import { getFallback, getLanguage, resolveLocale } from "./registry.js";
import { emitWarning } from "./warnings.js";

/**
 * The inflection engine: sync rule-based inflection plus the two-pass async
 * upgrade path.
 *
 * Design: packs are pure and synchronous. All answers a pack cannot derive
 * from rules go through `ctx.lookup`, which reads the shared oracle cache
 * below. `inflectAsync` runs the pack once, feeds the recorded misses to the
 * registered fallback, fills the cache, and re-runs the pack synchronously —
 * so after the first async resolution, plain sync `inflect`/`format` calls
 * return the corrected forms too.
 */

/** Shared answers produced by fallbacks, keyed by locale/lemma/tag. */
const oracleCache = new LruCache<string, string>(2000);

function oracleKey(locale: string, request: FallbackRequest): string {
  return `${locale}\0${request.lemma}\0${request.tag}`;
}

/**
 * Seed the oracle cache directly (used by tests and by applications that
 * want to pre-store known answers, e.g. from a server response).
 */
export function seedOracle(locale: string, request: FallbackRequest, form: string): void {
  oracleCache.set(oracleKey(resolveLocale(locale), request), form);
}

/** Clear the oracle cache (test isolation). */
export function clearOracle(): void {
  oracleCache.clear();
}

interface PackRun {
  text: string;
  confidence: "high" | "low";
  misses: FallbackRequest[];
}

function runPack(pack: LanguagePack, phrase: string, features: GrammaticalFeatures): PackRun {
  const misses: FallbackRequest[] = [];
  const seen = new Set<string>();
  const ctx: InflectionContext = {
    locale: pack.locale,
    lookup: (request) => oracleCache.get(oracleKey(pack.locale, request)),
    requestFallback: (request) => {
      const key = oracleKey(pack.locale, request);
      if (!seen.has(key)) {
        seen.add(key);
        misses.push(request);
      }
    },
    warn: (code, detail) => emitWarning({ code, locale: pack.locale, detail }),
  };
  const result = pack.inflectPhrase(phrase, features, ctx);
  return { text: result.text, confidence: result.confidence, misses };
}

function packOrWarn(locale: string): LanguagePack | undefined {
  const pack = getLanguage(locale);
  if (!pack) emitWarning({ code: "unknown-locale", locale: resolveLocale(locale), detail: locale });
  return pack;
}

/**
 * Inflect a phrase synchronously using rules, lexicon and any cached
 * fallback answers. Unknown locales return the phrase unchanged (with a
 * warning) — this function never throws on user input.
 *
 * @example
 * ```ts
 * import "intl-inflect/hu";
 * inflect("hu", "kőr ász", { case: "instrumental" }); // "kőr ásszal"
 * ```
 */
export function inflect(
  locale: string,
  phrase: string,
  features: GrammaticalFeatures = {},
): string {
  const pack = packOrWarn(locale);
  if (!pack) return phrase;
  return runPack(pack, phrase, features).text;
}

/**
 * Like {@link inflect}, but may await the registered fallback (e.g. the
 * neural module) for words the rules were unsure about. Falls back to the
 * best synchronous answer when no fallback is registered or it fails.
 */
export async function inflectAsync(
  locale: string,
  phrase: string,
  features: GrammaticalFeatures = {},
): Promise<string> {
  const pack = packOrWarn(locale);
  if (!pack) return phrase;
  const first = runPack(pack, phrase, features);
  if (first.misses.length === 0) return first.text;
  const fallback = getFallback(pack.locale);
  if (!fallback) return first.text;
  try {
    const answers = await fallback.predict(first.misses);
    first.misses.forEach((request, i) => {
      const answer = answers[i];
      if (typeof answer === "string" && answer.length > 0) {
        oracleCache.set(oracleKey(pack.locale, request), answer);
      }
    });
  } catch (error) {
    emitWarning({
      code: "fallback-error",
      locale: pack.locale,
      detail: error instanceof Error ? error.message : String(error),
    });
    return first.text;
  }
  // Second pass: same pure pack, now with the cache warm.
  return runPack(pack, phrase, features).text;
}

/**
 * Warm up the fallback for a locale (loads the neural session, if one is
 * registered). Safe to call unconditionally — resolves immediately when
 * there is nothing to preload.
 */
export async function preload(locale: string): Promise<void> {
  await getFallback(locale)?.preload?.();
}

/**
 * Internal: inflect with raw (string) template annotations. Used by the
 * template renderer so per-pack `normalizeFeatures` overrides apply.
 * @internal
 */
export function inflectRaw(locale: string, phrase: string, raw: Record<string, string>): string {
  const pack = packOrWarn(locale);
  if (!pack) return phrase;
  return runPack(pack, phrase, normalizeRawFor(pack, raw)).text;
}

/**
 * Internal async twin of {@link inflectRaw}.
 * @internal
 */
export async function inflectRawAsync(
  locale: string,
  phrase: string,
  raw: Record<string, string>,
): Promise<string> {
  const pack = packOrWarn(locale);
  if (!pack) return phrase;
  return inflectAsync(locale, phrase, normalizeRawFor(pack, raw));
}

function normalizeRawFor(pack: LanguagePack, raw: Record<string, string>): GrammaticalFeatures {
  const warn = (kind: "unknown-feature-key" | "unknown-feature-value", detail: string): void =>
    emitWarning({ code: kind, locale: pack.locale, detail });
  return pack.normalizeFeatures ? pack.normalizeFeatures(raw, warn) : normalizeFeatures(raw, warn);
}
