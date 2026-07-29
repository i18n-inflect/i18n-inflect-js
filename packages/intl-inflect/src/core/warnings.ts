/**
 * Warning channel.
 *
 * `inflect()`/`format()` never throw on bad input — they degrade gracefully
 * and report what they ignored through this hook, so problems surface in
 * development without breaking production rendering.
 */

/** Machine-readable warning categories. */
export type WarningCode =
  | "unknown-locale"
  | "unknown-feature-key"
  | "unknown-feature-value"
  | "missing-argument"
  | "malformed-template"
  | "missing-gender"
  | "fallback-error"
  | "fallback-rejected"
  | "low-confidence";

/** A single reported warning. */
export interface InflectWarning {
  code: WarningCode;
  /** Resolved language subtag, when the warning is locale-specific. */
  locale?: string;
  /** Human-readable detail (offending key, span, argument name, …). */
  detail: string;
}

/** Handler installed via {@link onWarning}. */
export type WarningHandler = (warning: InflectWarning) => void;

let handler: WarningHandler | undefined;

/**
 * Install a global warning handler (pass `undefined` to remove).
 *
 * Typical development setup: `onWarning(w => console.warn("[intl-inflect]", w))`.
 * No handler is installed by default — production stays silent.
 */
export function onWarning(next: WarningHandler | undefined): void {
  handler = next;
}

/** Report a warning to the installed handler (no-op without one). */
export function emitWarning(warning: InflectWarning): void {
  handler?.(warning);
}
