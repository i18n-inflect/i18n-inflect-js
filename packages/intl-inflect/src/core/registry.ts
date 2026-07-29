import type { InflectionFallback, LanguagePack } from "./pack.js";

/**
 * Global registries for language packs and fallbacks.
 *
 * Importing a language subpath (`import "intl-inflect/hu"`) registers its
 * pack here as a side effect; fallbacks (e.g. `@intl-inflect/neural`) are
 * registered explicitly by the application.
 */

const packs = new Map<string, LanguagePack>();
const fallbacks = new Map<string, InflectionFallback>();

/**
 * Reduce a BCP 47 tag to its primary language subtag: `"hu-HU"` → `"hu"`.
 * Falls back to naive splitting when `Intl.Locale` rejects the input.
 */
export function resolveLocale(locale: string): string {
  try {
    return new Intl.Locale(locale).language;
  } catch {
    return locale.split(/[-_]/, 1)[0]?.toLowerCase() ?? locale.toLowerCase();
  }
}

/** Register (or replace) a language pack. */
export function registerLanguage(pack: LanguagePack): void {
  packs.set(pack.locale, pack);
}

/** Register (or replace) a fallback oracle for its locale. */
export function registerFallback(fallback: InflectionFallback): void {
  fallbacks.set(fallback.locale, fallback);
}

/** Look up the pack serving a locale (accepts full BCP 47 tags). */
export function getLanguage(locale: string): LanguagePack | undefined {
  return packs.get(resolveLocale(locale));
}

/** Look up the fallback serving a locale (accepts full BCP 47 tags). */
export function getFallback(locale: string): InflectionFallback | undefined {
  return fallbacks.get(resolveLocale(locale));
}

/** List the registered language subtags (mainly for diagnostics/tests). */
export function registeredLocales(): string[] {
  return [...packs.keys()];
}

/**
 * Remove every registered pack and fallback.
 *
 * Intended for test isolation only — applications never need this.
 */
export function resetRegistry(): void {
  packs.clear();
  fallbacks.clear();
}
