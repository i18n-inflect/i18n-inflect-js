# Data licensing

The **code** in this repository is MIT-licensed (see [LICENSE](./LICENSE)).

Some **generated data files** shipped inside the packages are derived from
third-party lexical resources and carry their own license:

| Artifact | Derived from | License |
| --- | --- | --- |
| `packages/i18n-inflect/src/*/exceptions.gen.ts` | [UniMorph](https://unimorph.github.io/) and [Wiktionary](https://en.wiktionary.org/) (via the [wiktextract](https://kaikki.org/) dumps) | [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/) |
| `packages/i18n-inflect/test/fixtures/*.golden.json` | UniMorph held-out splits | CC BY-SA 3.0 |
| `@i18n-inflect/model-*` neural weights | trained on UniMorph data | CC BY-SA 3.0 |

Attribution: UniMorph (© UniMorph contributors) and the English Wiktionary
(© Wikimedia contributors), the latter read through Tatu Ylonen's wiktextract
dumps published at kaikki.org. Both derive from Wiktionary, which is CC BY-SA. Each generated file carries a header
naming its exact source repository and the pinned commit it was built from.

Design references that contribute **no shipped data** (consulted for rule
design and used as optional cross-validation oracles only):
[morphdb.hu](http://mokk.bme.hu/en/resources/morphdb-hu/) (MOKK, BME),
[emMorph / e-magyar](https://e-magyar.hu/hu/textmodules/emmorph),
[hunmorph](http://mokk.bme.hu/resources/hunmorph/), and
[multilingual-inflection](https://github.com/tomsouri/multilingual-inflection)
(Sourada & Straka, 2025 — training recipe reference).
