# i18n-inflect

## 0.6.0

### Minor Changes

- e4e7106: Four new language packs — Turkish, Portuguese, Polish and Russian — and German
  gains the gender and plural lexicons it was missing.

  **Turkish** (`i18n-inflect/tr`): two vowel-harmony systems choosing the suffix
  vowel, final-consonant softening with a lexicon for the words that refuse it
  (`kitap` → `kitabı` but `top` → `topu`), possessive compounds (`göbek dansına`)
  and the apostrophe proper nouns take before a suffix (`İstanbul'a`). The rules
  alone are right 97.5% of the time, so the lexicon is 1.5 kB.

  **Portuguese** (`i18n-inflect/pt`): the preposition-article contractions that
  are obligatory rather than stylistic — `de + o` is `do`, and `de o` is an error
  — including the crase (`à`), plus plurals with the `-ão`/`-l`/`-m` rules and a
  generated gender lexicon.

  **Polish** (`i18n-inflect/pl`) and **Russian** (`i18n-inflect/ru`): full case
  paradigms with the stem changes the endings force — palatalization
  (`kot` → `kocie`), the fleeting vowel (`pies` → `psa`, `немец` → `немца`), the
  `ó`/`o` alternation (`stół` → `stołu`) — plus adjective agreement and animacy
  in the accusative. The lexicons store a compact paradigm signature per noun
  rather than forms.

  **German** (`i18n-inflect/de`): gender no longer has to come from the caller,
  and plurals are formed rather than demanded. Compounds are resolved from their
  final element, so `Krankenhaus` → `Krankenhäuser` works — and so does a
  compound no dictionary lists. **Behaviour change:** give the phrase in the
  nominative singular; `number: "plural"` now builds the plural itself instead of
  expecting the caller to supply a plural noun.

  Every pipeline now reports accuracy on a held-out tenth of its corpus, which is
  the number that means something. The playground follows the published release
  instead of a pinned version that had fallen four minors behind.

## 0.5.0

### Minor Changes

- Hungarian possession and the essive-formal case; a new Italian pack; gender
  lexicons for Spanish and Italian.

  **Hungarian.** The full possessive paradigm — `házam`, `házunk`, `házaitok`,
  `kertjeik` — through new `possessor` and `possessorNumber` features, plus
  `case: "essiveFormal"` for `-ként`. Possession is where every stem class
  shows through at once, and where the language keeps one genuinely lexical
  choice: the third person takes `-a/-e` for some words and `-ja/-je` for
  others, with nothing in the shape of `ház` versus `kalap` to predict _háza_
  against _kalapja_. That choice is learned from the corpus, not guessed.

  **Italian**, a new pack. Articles are selected by the sound that follows —
  il/lo/l'/la/i/gli/le — and prepositions fuse with them, which is most of what
  makes generated Italian read naturally: `del libro`, `allo sport`,
  `dell'amico`, `sugli amici`. Cases map onto the preposition that marks the
  role, so `case: "genitive"` gives `di`, `"dative"` gives `a`, and the same
  feature name works across languages that mark roles with endings and ones
  that mark them with words.

  **Spanish and Italian gender lexicons**, generated from Wiktionary. Gender is
  lexical in both languages, and requiring `gender` on every call was work the
  library should absorb: `el mapa`, `la mano`, `il problema` and `la foto` now
  come out right unasked. Only nouns whose ending misleads are stored — 2,736
  for Spanish out of 58,492, 4,359 for Italian out of 59,752 — along with the
  plurals the spelling rules do not produce. Words with two genders (`il radio`
  the element, `la radio` the wireless) are deliberately left out: nothing in
  the string decides, so the caller's `gender` should.

## 0.4.0

### Minor Changes

- Hungarian: merge the current Wiktionary into the lexicon alongside UniMorph.

  UniMorph's Hungarian data is itself a Wiktionary extraction, but pinned to
  2023 and limited to what UniMorph included. Reading today's dump directly
  adds 4,847 lemmas (12,086 → 16,933) — and, more valuably, cross-checks the
  data we already had: where the two sources describe the same form they agree
  99.8% of the time.

  The dump is not needed to build the package; the generated lexicon is
  committed and the pipeline falls back to UniMorph alone without it.

  The larger vocabulary costs bundle size: the Hungarian pack goes from 25 kB
  to 34 kB gzipped. Nothing else changes — the other languages and the core
  are untouched, and you only pay for the language you import.

## 0.3.1

### Patch Changes

- Hungarian: check the rules against the Academy's orthography, and settle two
  cases the corpus alone could not.

  Every worked example from AkH. 12. rule 82 — the -val/-vel and -vá/-vé
  alternations — is now asserted in the test suite. All but one passed
  already; the exception was symbols, so `%`, `€`, `$`, `£`, `°`, `+`, `&` and
  `@` now have spoken forms and take their suffix accordingly: `15%-kal`.

  Rule 82. e) permits both `dühvel` and `dühhel` for nouns whose final `h`
  fluctuates in pronunciation. The library now consistently writes the
  unassimilated form for that closed set (cseh, doh, düh, éh, juh, méh, oláh,
  pléh, rüh).

  Homonyms whose readings inflect differently — `nyár` summer/poplar, `szél`
  wind/edge — are now resolved in favour of the commoner word rather than
  whichever the corpus diff happened to pick: nyarat, szelet, telet.

## 0.3.0

### Minor Changes

- Hungarian: ship the lexicon for the whole corpus, not just the training
  split. Withholding vocabulary from users bought nothing — the split exists
  to measure generalization, and the pipeline now builds a second,
  training-only lexicon for that purpose so the measurement stays honest. The
  shipped lexicon covers all 12,086 UniMorph noun lemmas, taking accuracy on
  that vocabulary to 99.6% (any attested form of a word with free variation
  counts). Generalization to words the lexicon has never seen is unchanged at
  94.6%.

  Also fixes false compound splits introduced by the harmony-head entries:
  `tartalék` is not `tarta` + `lék`, but the head list is what made it look
  that way. The safety checks now run against the final head set, which puts
  `lék` and six others on the blocklist.

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
