import type { GrammaticalFeatures } from "../core/features.js";
import type { InflectionContext, InflectionResult, LanguagePack } from "../core/pack.js";
import { splitTrailingPunctuation } from "../core/phrase.js";
import { registerLanguage } from "../core/registry.js";
import { finalSoundOf } from "./hangul.js";
import { isKoRole, particleFor } from "./particles.js";

/**
 * Korean language pack: phonological case-particle attachment
 * (은/는, 이/가, 을/를, (으)로, 과/와, 의) driven by the batchim of the last
 * syllable, with digit readings and a paired-form fallback for
 * undecidable (e.g. Latin) finals.
 *
 * `import "i18n-inflect/ko"` registers it as a side effect.
 */

function inflectPhrase(
  phrase: string,
  features: GrammaticalFeatures,
  ctx: InflectionContext,
): InflectionResult {
  const [core, punct] = splitTrailingPunctuation(phrase.trimEnd());
  const trailingWs = phrase.slice(phrase.trimEnd().length);
  if (core.length === 0) return { text: phrase, confidence: "high" };

  let body = core;

  // Optional plural marker 들 (commonly omitted in Korean; applied on request).
  if (features.number === "plural") body += "들";

  let confidence: "high" | "low" = "high";
  if (features.case && features.case !== "nominative" && !isKoRole(features.case)) {
    ctx.warn("unknown-feature-value", `case not supported for ko: ${features.case}`);
  } else if (features.case && isKoRole(features.case)) {
    const final = finalSoundOf(body);
    if (final === undefined) confidence = "low"; // paired form used
    body += particleFor(features.case, final);
  }

  return { text: body + punct + trailingWs, confidence };
}

/** The Korean language pack. */
export const ko: LanguagePack = {
  locale: "ko",
  inflectPhrase,
};

registerLanguage(ko);
