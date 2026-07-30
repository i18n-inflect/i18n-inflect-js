---
"i18n-inflect": minor
---

Four new language packs — Turkish, Portuguese, Polish and Russian — and German
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
