/**
 * Template AST.
 *
 * Exported as part of the public API so alternative renderers (for example a
 * future MessageFormat 2 adapter) can reuse the parser.
 */

/** Literal text. */
export interface TextNode {
  kind: "text";
  value: string;
}

/** A `{name}` placeholder. */
export interface VariableNode {
  kind: "var";
  name: string;
}

/**
 * A `^[body](key: value; …)` inflection span. `features` holds the raw
 * string annotations — they are normalized per-locale at format time.
 */
export interface InflectNode {
  kind: "inflect";
  body: (TextNode | VariableNode)[];
  features: Record<string, string>;
}

/** Any template node. */
export type TemplateNode = TextNode | VariableNode | InflectNode;

/** A parsed template. */
export interface Template {
  nodes: TemplateNode[];
}
