# i18n-inflect

## 0.2.1

### Patch Changes

- Hungarian: stop treating derivational suffixes as compound heads. A word
  ending in a known lemma is not necessarily a compound of it — `régész` is
  `rég` plus the agent suffix `-ész`, and inheriting the noun `ész`'s
  shortening stem produced \*régeszek. The data pipeline now scores every
  candidate head across the corpus and blocklists the ones that lose more
  forms than they fix (28 of them, including -ész, -tár and -vár), lifting
  held-out accuracy from 94.7% to 94.9%.

## 0.2.0

### Minor Changes

- Hungarian: inflect compounds after their final member, and derive relational
  adjectives.

  Compounding is unboundedly productive, so no lexicon can list compounds
  themselves — but their final member decides how they inflect. Unknown words
  are now matched against the longest lexicon lemma they end with and inherit
  its behaviour, with alternate stems rebased onto the whole word: kávéház →
  kávéházat, tábortűz → tábortüzet, fénysugár → fénysugarak. Harmony follows
  the head too, so halottkém → halottkémek rather than \*halottkémok. This
  lifts held-out accuracy on entirely unseen lemmas from 92.8% to 94.7% at no
  cost in bundle size.

  New `derivation: "relational"` feature for the `-i` adjective: Budapest →
  budapesti, Kanada → kanadai (no lengthening, unlike every case suffix),
  Helsinki → helsinki (the suffix is absorbed). The derived adjective then
  inflects as its own word: budapestiek, budapestit.

## 0.1.2

### Patch Changes

- aab164a: Expose `./package.json` in the `exports` map. Bundler plugins, framework
  integrations and tooling routinely read a dependency's `package.json`, and an
  `exports` map that omits it makes those reads fail with
  `ERR_PACKAGE_PATH_NOT_EXPORTED`.

## 0.1.1

### Patch Changes

- Fix language packs not registering when the package is loaded through
  CommonJS. Each `require()` entry bundled its own copy of the core, so
  `require("i18n-inflect/hu")` populated a different registry than
  `require("i18n-inflect")` read from, and every call returned its input
  unchanged — silently, with no error. The build now emits a shared chunk for
  both module formats, and a new post-build check exercises the published
  artifacts through `import` and `require` so this cannot regress. ESM users
  were unaffected.
