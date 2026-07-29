import { LruCache } from "../core/cache.js";
import { emitWarning } from "../core/warnings.js";
import type { Template, TemplateNode, TextNode, VariableNode } from "./ast.js";

/**
 * Hand-written single-pass parser for the template grammar:
 *
 * ```
 * template  := element*
 * element   := TEXT | escape | variable | span
 * escape    := "\" ANY                      // the literal char, everywhere
 * variable  := "{" ident "}"                // ident: [A-Za-z_][A-Za-z0-9_]*
 * span      := "^[" body "](" features ")"
 * body      := (TEXT | escape | variable)*  // no nested spans
 * features  := pair (";" pair)* ";"?        // pair: key ":" value
 * ```
 *
 * Malformed input is never an error: an unmatched `^[`, `{`, or feature list
 * falls back to literal text (with a `malformed-template` warning), so a
 * translator's typo can only ever cost an inflection, not a render.
 */

const IDENT_START = /[A-Za-z_]/;
const IDENT_CHAR = /[A-Za-z0-9_]/;

const parseCache = new LruCache<string, Template>(500);

/** Parse a template string (memoized on the source string). */
export function parseTemplate(source: string): Template {
  const cached = parseCache.get(source);
  if (cached) return cached;
  const template = parse(source);
  parseCache.set(source, template);
  return template;
}

function parse(source: string): Template {
  const nodes: TemplateNode[] = [];
  let text = "";

  const flushText = (): void => {
    if (text.length > 0) {
      nodes.push({ kind: "text", value: text });
      text = "";
    }
  };

  let i = 0;
  while (i < source.length) {
    const ch = source[i] as string;
    if (ch === "\\" && i + 1 < source.length) {
      text += source[i + 1];
      i += 2;
      continue;
    }
    if (ch === "{") {
      const variable = tryParseVariable(source, i);
      if (variable) {
        flushText();
        nodes.push(variable.node);
        i = variable.end;
        continue;
      }
      warnMalformed(source, i);
    }
    if (ch === "^" && source[i + 1] === "[") {
      const span = tryParseSpan(source, i);
      if (span) {
        flushText();
        nodes.push(span.node);
        i = span.end;
        continue;
      }
      warnMalformed(source, i);
    }
    text += ch;
    i += 1;
  }
  flushText();
  return { nodes };
}

function warnMalformed(source: string, at: number): void {
  emitWarning({
    code: "malformed-template",
    detail: `treating as literal text at index ${at}: …${source.slice(at, at + 24)}`,
  });
}

function tryParseVariable(
  source: string,
  start: number,
): { node: VariableNode; end: number } | undefined {
  let i = start + 1;
  const first = source[i];
  if (first === undefined || !IDENT_START.test(first)) return undefined;
  let name = first;
  i += 1;
  while (i < source.length && IDENT_CHAR.test(source[i] as string)) {
    name += source[i];
    i += 1;
  }
  if (source[i] !== "}") return undefined;
  return { node: { kind: "var", name }, end: i + 1 };
}

function tryParseSpan(
  source: string,
  start: number,
): { node: TemplateNode; end: number } | undefined {
  // Body runs from after "^[" to the first unescaped "](" sequence.
  const body: (TextNode | VariableNode)[] = [];
  let text = "";
  const flushText = (): void => {
    if (text.length > 0) {
      body.push({ kind: "text", value: text });
      text = "";
    }
  };

  let i = start + 2;
  while (i < source.length) {
    const ch = source[i] as string;
    if (ch === "\\" && i + 1 < source.length) {
      text += source[i + 1];
      i += 2;
      continue;
    }
    if (ch === "]" && source[i + 1] === "(") {
      const features = tryParseFeatures(source, i + 2);
      if (!features) return undefined;
      flushText();
      return {
        node: { kind: "inflect", body, features: features.features },
        end: features.end,
      };
    }
    if (ch === "{") {
      const variable = tryParseVariable(source, i);
      if (variable) {
        flushText();
        body.push(variable.node);
        i = variable.end;
        continue;
      }
    }
    text += ch;
    i += 1;
  }
  return undefined; // no "](" found — caller falls back to literal text
}

function tryParseFeatures(
  source: string,
  start: number,
): { features: Record<string, string>; end: number } | undefined {
  const close = source.indexOf(")", start);
  if (close === -1) return undefined;
  const features: Record<string, string> = {};
  const list = source.slice(start, close);
  for (const pair of list.split(";")) {
    const trimmed = pair.trim();
    if (trimmed.length === 0) continue; // tolerate a trailing ";"
    const colon = trimmed.indexOf(":");
    if (colon === -1) return undefined; // not a feature list — not a span
    const key = trimmed.slice(0, colon).trim();
    const value = trimmed.slice(colon + 1).trim();
    if (key.length === 0 || !/^[A-Za-z][A-Za-z0-9]*$/.test(key)) return undefined;
    features[key] = value;
  }
  return { features, end: close + 1 };
}
