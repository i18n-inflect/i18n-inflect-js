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

**[Try it in your browser →](https://i18n-inflect.github.io/i18n-inflect-js/)** Type a word and watch every form it can take, with the
part the library added highlighted.

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
| 🇭🇺 **Hungarian** | 15 case suffixes + plural with full vowel harmony, stem alternations (kéz→kezet, bokor→bokrot, ló→lovat), v-assimilation (ász→ásszal, busz→busszal), a/az article by pronunciation ("az 5", "a 6", "az MTA", "a BKV"), and suffixes written after a hyphen for numbers, initialisms and foreign words — spelled from their spoken form: 6-ot, 5-tel, 1-gyel, 100-zal, 1000-et, SMS-t, MTA-ban, tv-vel. Compounds inflect after their final member (kávéház→kávéházat, tábortűz→tábortüzet), the relational adjective is derivable (Budapest→budapesti), and the full possessive paradigm is covered including its one lexical choice (háza but kertje, házaitok, kertjeik) |
| 🇬🇧 **English** | a/an by sound (an hour, a university, an MTA card, an 8), pluralization |
| 🇩🇪 **German** | full article matrix (4 cases × 3 genders), weak/mixed/strong adjective endings ("ein rotes Auto" → "einem roten Auto"), and generated gender *and* plural lexicons. Compounds are resolved from their final element, so `Krankenhaus` → `Krankenhäuser` works — and so does a compound no dictionary lists |
| 🇫🇷 **French** | le/la/les/un/une with elision (l'ami) and h-aspiré (le haricot), pluralization |
| 🇪🇸 **Spanish** | el/la/los/las/un/una incl. the stressed-á rule (el agua → las aguas), pluralization, and a generated gender lexicon covering the traps (el mapa, la mano) |
| 🇮🇹 **Italian** | articles chosen by the sound that follows (il/lo/l'/la/i/gli/le), articulated prepositions (del, allo, nell', sui), plurals with the spelling rules that keep consonant sounds (amico→amici but fuoco→fuochi), and a generated gender lexicon so you rarely pass `gender` |
| 🇵🇹 **Portuguese** | the obligatory preposition-article contractions (de+o→do, em+a→na, a+o→ao, por+as→pelas) including the crase (à), plurals with the -ão/-l/-m rules (coração→corações, animal→animais, homem→homens), and a generated gender lexicon |
| 🇵🇱 **Polish** | seven cases in two numbers with the stem changes the endings force: palatalization (kot→kocie, książka→książce), the fleeting e (pies→psa), the ó/o alternation (stół→stołu) — plus adjective agreement and the masculine personal plural (student→studenci) |
| 🇷🇺 **Russian** | six cases in two numbers over hard and soft stems, the two spelling rules that override them (книга→книги, немец→немцем), the fleeting vowel (немец→немца), animacy in the accusative (кота, котов), and adjective agreement |
| 🇹🇷 **Turkish** | two vowel-harmony systems choosing the suffix vowel (evde/kitapta/gözü/okulu), final-consonant softening (kitap→kitabı) with the lexicon for the words that refuse it (top→topu), possessive compounds (göbek dansına) and the apostrophe after proper nouns (İstanbul'a) |
| 🇰🇷 **Korean** | phonological particles by final batchim: 은/는, 이/가, 을/를, (으)로, 과/와 — with digit readings (8로, 3으로) and paired forms for Latin text (Chrome을(를)) |

More languages plus Vietnamese and Japanese are on the roadmap; the language
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

## What it cannot know

Some words are two words, and the two inflect differently. Hungarian `nyár`
is "summer" (*nyarat*) and "poplar" (*nyárat*); `szél` is "wind" (*szelet*)
and "edge" (*szélt*). A function from string to string has no way to tell
them apart, so the library picks the commoner reading and documents the
choice. When you know the sense, say so:

```ts
import { seedOracle, inflect } from "i18n-inflect";

seedOracle("hu", { lemma: "nyár", tag: "N;ACC;SG" }, "nyárat"); // the tree
inflect("hu", "nyár", { case: "accusative" }); // → "nyárat"
```

The same limit applies wherever orthography permits more than one form:
AkH. 82. e) allows both `dühvel` and `dühhel`, and the library consistently
writes the first.

## Data, accuracy, licensing

The Hungarian rules are checked against the Hungarian Academy of Sciences'
orthography — *A magyar helyesírás szabályai*, 12th edition
([AkH. 12.](https://helyesiras.mta.hu/helyesiras/default/akh12)) — with every
worked example from rule 82 (the -val/-vel and -vá/-vé alternations) asserted
in the test suite, and against [UniMorph](https://unimorph.github.io/)
(1M+ forms): **~17k noun lemmas ship in the generated lexicon**, merged from UniMorph and the
current Wiktionary (the two agree on 99.8% of the forms they share, which is
worth as much as either source alone). Accuracy on that vocabulary is 99.6%;
on lemmas the lexicon has never seen at all, 94.2%.

Every lexicon in the library is built the same way: the rules are run against
a corpus and **only what they get wrong is stored**. That keeps the data small,
and it makes the rules' real coverage visible — a language needing thousands of
entries is a language whose rules are worth improving first. Each pipeline
therefore reports two numbers: how far the rules get on their own, and how the
whole pack does on a deterministic tenth of the corpus held back from the build.
The second is the honest one, because a lexicon cannot help with a word it has
never seen — which is the gap the neural fallback exists to close.

| | rules alone | on words it has seen | on unseen words |
| --- | --- | --- | --- |
| 🇭🇺 Hungarian | — | 99.6% | 94.2% |
| 🇷🇺 Russian | 89.1% | 100% | 89.2% |
| 🇵🇱 Polish | 86.6% | 100% | 85.6% |
| 🇹🇷 Turkish | 97.5% | 100% | — |
| 🇩🇪 German | 75.5% gender, 80.7% plural | 100% | 86.4% / 89.4% |
| 🇵🇹 Portuguese | 92.1% gender, 93.9% plural | 100% | 92.6% / 93.8% |

Measured per paradigm cell (Hungarian, Russian, Polish, Turkish) or per noun
(German, Portuguese). German's rules look weak until you notice what fixes
them: a compound takes the gender and plural of its final element, and adding
that one step lifts gender from 75.5% to 88.1% — without storing a single
compound. Reproduce any row with `pnpm pipeline:hu`, `pipeline:pl`, `pipeline:ru`,
`pipeline:tr` or `pipeline:nouns` (German, Portuguese, Spanish, Italian).

The lexicons, golden test fixtures and neural weights are UniMorph/Wiktionary
derivatives (CC BY-SA 3.0 — see [LICENSE-DATA.md](LICENSE-DATA.md)); all code
is MIT.

## Packages

| Package | Contents |
| --- | --- |
| `i18n-inflect` | core + template engine + all rule-based language packs (zero deps) |
| `@i18n-inflect/neural` | neural fallback runtime with swappable inference engines |
| `@i18n-inflect/model-hu` | Hungarian model weights — built by the models workflow, not published yet |

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

**Docs:** [playground](https://i18n-inflect.github.io/i18n-inflect-js/) · [template spec](docs/template-spec.md) ·
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
The neural runtime is published; the Hungarian model weights are not yet, so the neural
fallback needs a locally built model for now. The rule engine works without either.

## License

MIT (code) — see [LICENSE](LICENSE). Generated data and model weights: CC BY-SA 3.0 —
see [LICENSE-DATA.md](LICENSE-DATA.md).
