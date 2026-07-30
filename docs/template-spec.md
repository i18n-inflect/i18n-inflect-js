# Template specification

The template layer understood by `format()` / `formatAsync()`.
The [playground](https://i18n-inflect.github.io/i18n-inflect-js/) runs these templates live if you would rather try than read.

## Grammar

```
template  := element*
element   := TEXT | escape | variable | span
escape    := "\" ANY                       — the literal character, everywhere
variable  := "{" ident "}"                 — ident: [A-Za-z_][A-Za-z0-9_]*
span      := "^[" body "](" features ")"
body      := (TEXT | escape | variable)*   — no nested spans
features  := pair (";" pair)* ";"?         — pair: key ":" value, trimmed
key       := [A-Za-z][A-Za-z0-9]*
value     := any characters except ";" and ")"
```

## Semantics, in order

1. **Escaping.** `\` escapes the next character anywhere: `\^`, `\[`, `\{`, `\\`.
   There is no `{{` doubling — one mechanism only.
2. **Never throws.** A `^` not followed by `[`, a span without a matching `](…)`,
   a `{` without a valid identifier and `}` — all are treated as literal text.
   A `malformed-template` warning is emitted via `onWarning` so typos surface in
   development.
3. **Interpolation before inflection.** `{var}` placeholders inside a span body are
   substituted first; the language pack sees the final surface phrase. This is the
   point of the design: grammar agrees with *runtime values*.
   Arguments are `Record<string, string | number>`; numbers are stringified with
   `String()`. A missing argument leaves `{var}` in place and warns
   (`missing-argument`).
4. **Features.** Keys map to the core feature model:
   `case`, `number`, `gender`, `definiteness`, `article`, `person`,
   `pos` / `partOfSpeech`. Values are the lowercase enum names
   (`case: instrumental`, `number: plural`, `article: indefinite`, …).
   Unknown keys/values are ignored with a warning — a translator's typo can cost an
   inflection, never a render.
5. **`inflect: true`** (Apple compatibility) is accepted and reserved for the future
   automatic-agreement layer; today it applies no explicit feature but still runs the
   pack's phrase normalization (e.g. English a/an re-agreement).
6. **Unknown locale.** Variables are interpolated, span syntax is stripped, body text
   passes through unchanged (`unknown-locale` warning).

## The AST is public

`parseTemplate(source)` returns the typed AST (`Template`, `TextNode`, `VariableNode`,
`InflectNode`) and is memoized. Alternative renderers — for example a future
MessageFormat 2 adapter exposing `:inflect` — can reuse the parser instead of
reimplementing the syntax.

## Examples

```ts
format("hu", "Nyertél ^[a {card}](case: instrumental)!", { card: "kőr ász" });
// → "Nyertél a kőr ásszal!"

format("hu", "^[a ház](number: plural; case: inessive)");
// → "a házakban"

format("en", "literal \\^[not a span\\]");
// → "literal ^[not a span]"

format("de", "Ich fahre mit ^[ein rotes Auto](case: dative; gender: neuter)");
// → "Ich fahre mit einem roten Auto"

format("ko", "^[{app}](case: topic) 최고!", { app: "지도" });
// → "지도는 최고!"
```
