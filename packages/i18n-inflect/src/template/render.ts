import { emitWarning } from "../core/warnings.js";
import type { Template, TextNode, VariableNode } from "./ast.js";

/** Values usable as template arguments. Numbers are stringified. */
export type TemplateArgs = Record<string, string | number>;

/** Inflects an interpolated span body; sync and async variants. */
export type SpanInflector = (phrase: string, features: Record<string, string>) => string;
export type AsyncSpanInflector = (
  phrase: string,
  features: Record<string, string>,
) => Promise<string>;

function substitute(nodes: (TextNode | VariableNode)[], args: TemplateArgs): string {
  let out = "";
  for (const node of nodes) {
    if (node.kind === "text") {
      out += node.value;
    } else if (Object.hasOwn(args, node.name)) {
      out += String(args[node.name]);
    } else {
      emitWarning({ code: "missing-argument", detail: node.name });
      out += `{${node.name}}`;
    }
  }
  return out;
}

/** Render a parsed template with a synchronous span inflector. */
export function renderTemplate(
  template: Template,
  args: TemplateArgs,
  inflectSpan: SpanInflector,
): string {
  let out = "";
  for (const node of template.nodes) {
    if (node.kind === "inflect") {
      out += inflectSpan(substitute(node.body, args), node.features);
    } else {
      out += substitute([node], args);
    }
  }
  return out;
}

/** Render a parsed template, awaiting each span's inflection. */
export async function renderTemplateAsync(
  template: Template,
  args: TemplateArgs,
  inflectSpan: AsyncSpanInflector,
): Promise<string> {
  const parts: (string | Promise<string>)[] = [];
  for (const node of template.nodes) {
    if (node.kind === "inflect") {
      parts.push(inflectSpan(substitute(node.body, args), node.features));
    } else {
      parts.push(substitute([node], args));
    }
  }
  return (await Promise.all(parts)).join("");
}
