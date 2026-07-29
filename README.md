# i18n-inflect

[![npm](https://img.shields.io/npm/v/i18n-inflect.svg)](https://www.npmjs.com/package/i18n-inflect)
[![CI](https://github.com/i18n-inflect/i18n-inflect-js/actions/workflows/ci.yml/badge.svg)](https://github.com/i18n-inflect/i18n-inflect-js/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Types](https://img.shields.io/badge/types-included-blue.svg)](#)
[![Zero dependencies](https://img.shields.io/badge/dependencies-0-brightgreen.svg)](#)

**Grammatical inflection and agreement for i18n — in the browser, Node.js, and Cordova.**

Localized strings constantly need grammar that `printf`-style interpolation can't provide:
the right article, the right case suffix, the right particle — *for a value only known at
runtime*. i18n-inflect fills that gap with an API inspired by Apple Foundation's
[automatic grammar agreement](https://developer.apple.com/videos/play/wwdc2021/10109/)
(`^[...](inflect: true)`), but open source, extensible, and with languages Apple doesn't
cover — starting with Hungarian.

```ts
import { format } from "i18n-inflect";
import "i18n-inflect/hu";
import "i18n-inflect/en";

format("hu", "Nyertél ^[a {card}](case: instrumental)!", { card: "kőr ász" });
// → "Nyertél a kőr ásszal!"        (case suffix + v-assimilation + a/az article)

format("hu", "^[a {n}](case: accusative) dobtad", { n: "hat" });
// → "a hatot dobtad"

format("en", "You drew ^[a {c}](article: indefinite)", { c: "ace" });
// → "You drew an ace"
```

## What it does

| | |
| --- | --- |
| 🇭🇺 **Hungarian** | 15 case suffixes + plural with full vowel harmony, stem alternations (kéz→kezet, bokor→bokrot, ló→lovat), v-assimilation (ász→ásszal, busz→busszal), a/az article by pronunciation ("az 5", "a 6", "az MTA", "a BKV"), and suffixes written after a hyphen for numbers, initialisms and foreign words — spelled from their spoken form: 6-ot, 5-tel, 1-gyel, 100-zal, 1000-et, SMS-t, MTA-ban, tv-vel |
| 🇬🇧 **English** | a/an by sound (an hour, a university, an MTA card, an 8), pluralization |
| 🇩🇪 **German** | full article matrix (4 cases × 3 genders), weak/mixed/strong adjective endings ("ein rotes Auto" → "einem roten Auto") |
| 🇫🇷 **French** | le/la/les/un/une with elision (l'ami) and h-aspiré (le haricot), pluralization |
| 🇪🇸 **Spanish** | el/la/los/las/un/una incl. the stressed-á rule (el agua → las aguas), pluralization |
| 🇰🇷 **Korean** | phonological particles by final batchim: 은/는, 이/가, 을/를, (으)로, 과/와 — with digit readings (8로, 3으로) and paired forms for Latin text (Chrome을(를)) |

More European languages plus Vietnamese and Japanese are on the roadmap; the language
pack API is public and documented — see [docs/language-packs.md](docs/language-packs.md).

## Install

```sh
npm install i18n-inflect
```

Core is dependency-free and a few kB; each language is a tree-shakeable subpath import
that registers itself:

```ts
import { format, inflect } from "i18n-inflect";
import "i18n-inflect/hu";   // only the languages you import end up in your bundle
```

## The two API layers

**Template layer** — Apple-style spans inside localized strings, with `{var}`
interpolation happening *before* inflection (so grammar agrees with runtime values):

```ts
format("hu", "Kattints ^[a {gomb}](case: sublative)!", { gomb: "zöld gomb" });
// → "Kattints a zöld gombra!"
```

**Programmatic layer** — Morphology-like feature objects:

```ts
inflect("hu", "kőr ász", { case: "instrumental" });          // "kőr ásszal"
inflect("de", "der Hund", { case: "dative", gender: "masculine" }); // "dem Hund"
inflect("ko", "책", { case: "topic" });                       // "책은"
inflect("en", "a card", { number: "plural" });                // "cards"
```

Formatting **never throws** on malformed templates, unknown locales or unknown features —
it degrades to plain text and reports through `onWarning`. The exact grammar lives in
[docs/template-spec.md](docs/template-spec.md).

## Sync by default, neural when you want more

Rule + lexicon inflection is fully synchronous. For out-of-vocabulary words (rare,
foreign, or invented), an optional **neural fallback** — a ~2 MB character-level seq2seq
model per language, SIGMORPHON-style — can asynchronously improve answers:

```ts
import { registerFallback, preload, format, formatAsync } from "i18n-inflect";
import { createNeuralFallback } from "@i18n-inflect/neural";
import { loadModelHu } from "@i18n-inflect/model-hu";

registerFallback(createNeuralFallback({ model: await loadModelHu() }));
await preload("hu"); // optional warm-up

format("hu", "…");        // sync: rules + cached answers — never blocks
await formatAsync("hu", "…"); // may consult the model; answers are cached,
                              // so subsequent *sync* calls return them too
```

The inference engine is **swappable** ([docs/neural.md](docs/neural.md)): onnxruntime-web
(browser WASM), onnxruntime-node, or the
[`cordova-plugin-boogie-onnx`](https://github.com/boogie/cordova-plugin-boogie-onnx)
native bridge on Android/iOS — autodetected, or bring your own engine by implementing a
three-method interface.

## Data, accuracy, licensing

The Hungarian rule engine is validated against [UniMorph](https://unimorph.github.io/)
(1M+ forms): **~93% exact-match on held-out (unseen) lemmas by rules alone, 100% on
covered vocabulary with the generated 19 kB exception lexicon.** The lexicon, golden test
fixtures and neural weights are UniMorph/Wiktionary derivatives (CC BY-SA 3.0 — see
[LICENSE-DATA.md](LICENSE-DATA.md)); all code is MIT.

## Packages

| Package | Contents |
| --- | --- |
| `i18n-inflect` | core + template engine + all rule-based language packs (zero deps) |
| `@i18n-inflect/neural` | neural fallback runtime with swappable inference engines |
| `@i18n-inflect/model-hu` | Hungarian model weights (encoder + decoder ONNX + vocab) |

## Try it

```sh
git clone https://github.com/i18n-inflect/i18n-inflect-js && cd i18n-inflect-js
pnpm install && pnpm build
node scripts/demo.mjs                          # the whole library in one screen
node scripts/demo.mjs "zöld sárkány" sublative # inflect your own phrase
```

## Development

```sh
pnpm test          # vitest across packages (incl. UniMorph golden tests)
pnpm build         # tsup: ESM + CJS + d.ts
pnpm typecheck && pnpm lint
pnpm pipeline:hu   # regenerate the Hungarian lexicon + fixtures from UniMorph
node scripts/size-gate.mjs   # bundle budgets
```

The neural training pipeline (PyTorch → ONNX → int8) lives in
[training/](training/README.md).

**Docs:** [template spec](docs/template-spec.md) ·
[writing a language pack](docs/language-packs.md) · [neural setup](docs/neural.md) ·
[React usage](docs/react.md) · [contributing](CONTRIBUTING.md)

## Contributing

New languages and native-speaker corrections are the most valuable contributions —
if a form comes out wrong in your language, that is worth an issue even without a
fix. See [CONTRIBUTING.md](CONTRIBUTING.md) and
[docs/language-packs.md](docs/language-packs.md).

## Status

v0.1 — the API is settled and the Hungarian pack is validated against a million
UniMorph forms, but nothing is battle-tested in production yet. Expect the feature
model to gain fields (possessives, verb agreement) rather than change shape.
The neural model packages are not published yet; the rule engine works without them.

## License

MIT (code) — see [LICENSE](LICENSE). Generated data and model weights: CC BY-SA 3.0 —
see [LICENSE-DATA.md](LICENSE-DATA.md).
