/**
 * i18n-inflect — grammatical inflection and agreement for i18n.
 *
 * ```ts
 * import { format } from "i18n-inflect";
 * import "i18n-inflect/hu"; // registers the Hungarian pack
 *
 * format("hu", "Nyertél ^[a {card}](case: instrumental)!", { card: "kőr ász" });
 * // → "Nyertél a kőr ásszal!"
 * ```
 *
 * @packageDocumentation
 */

import { inflectRaw, inflectRawAsync } from "./core/engine.js";
import { parseTemplate } from "./template/parser.js";
import { renderTemplate, renderTemplateAsync, type TemplateArgs } from "./template/render.js";

// ---- engine ----
export {
  clearOracle,
  inflect,
  inflectAsync,
  preload,
  seedOracle,
} from "./core/engine.js";
// ---- core feature model ----
export type {
  ArticleRequest,
  Definiteness,
  Derivation,
  GrammaticalCase,
  GrammaticalFeatures,
  GrammaticalGender,
  GrammaticalNumber,
  GrammaticalPerson,
  PartOfSpeech,
} from "./core/features.js";
export { normalizeFeatures } from "./core/features.js";
// ---- pack + fallback contracts ----
export type {
  FallbackRequest,
  InflectionContext,
  InflectionFallback,
  InflectionResult,
  LanguagePack,
} from "./core/pack.js";
// ---- phrase helpers (public: for language pack authors) ----
export {
  capitalize,
  isCapitalized,
  joinPhrase,
  type SplitPhrase,
  splitPhrase,
  splitTrailingPunctuation,
} from "./core/phrase.js";
// ---- registry ----
export {
  getFallback,
  getLanguage,
  registeredLocales,
  registerFallback,
  registerLanguage,
  resetRegistry,
  resolveLocale,
} from "./core/registry.js";
// ---- warnings ----
export type { InflectWarning, WarningCode, WarningHandler } from "./core/warnings.js";
export { onWarning } from "./core/warnings.js";
// ---- template AST (public: reusable by alternative renderers) ----
export type {
  InflectNode,
  Template,
  TemplateNode,
  TextNode,
  VariableNode,
} from "./template/ast.js";
export { parseTemplate } from "./template/parser.js";
export type { TemplateArgs } from "./template/render.js";

/**
 * Format a template with Apple-style inflection spans.
 *
 * `^[body](key: value; …)` spans are interpolated (`{var}` placeholders
 * first) and then inflected by the locale's language pack. Synchronous:
 * uses rules, lexicon and previously cached fallback answers only.
 *
 * Never throws on malformed templates or unknown locales — it degrades to
 * plain interpolated text and reports via {@link onWarning}.
 *
 * @example
 * ```ts
 * format("en", "You drew ^[a {c}](article: indefinite)", { c: "ace" });
 * // → "You drew an ace"
 * ```
 */
export function format(locale: string, template: string, args: TemplateArgs = {}): string {
  return renderTemplate(parseTemplate(template), args, (phrase, features) =>
    inflectRaw(locale, phrase, features),
  );
}

/**
 * Like {@link format}, but spans may await the registered fallback (e.g.
 * the neural module) for words the rules were unsure about. Results are
 * cached, so subsequent synchronous {@link format} calls with the same
 * words return the corrected forms too.
 */
export async function formatAsync(
  locale: string,
  template: string,
  args: TemplateArgs = {},
): Promise<string> {
  return renderTemplateAsync(parseTemplate(template), args, (phrase, features) =>
    inflectRawAsync(locale, phrase, features),
  );
}
