# Data licensing

The **code** in this repository is MIT-licensed (see [LICENSE](./LICENSE)).

Some **generated data files** shipped inside the packages are derived from
third-party lexical resources and carry their own license:

| Artifact | Derived from | License |
| --- | --- | --- |
| `packages/intl-inflect/src/*/exceptions.gen.ts` | [UniMorph](https://unimorph.github.io/) (Wiktionary-extracted paradigms) | [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/) |
| `packages/intl-inflect/test/fixtures/*.golden.json` | UniMorph held-out splits | CC BY-SA 3.0 |
| `@intl-inflect/model-*` neural weights | trained on UniMorph data | CC BY-SA 3.0 |

Attribution: UniMorph (© UniMorph contributors, data extracted from the English
Wiktionary, © Wikimedia contributors). Each generated file carries a header
naming its exact source repository and the pinned commit it was built from.

Design references that contribute **no shipped data** (consulted for rule
design and used as optional cross-validation oracles only):
[morphdb.hu](http://mokk.bme.hu/en/resources/morphdb-hu/) (MOKK, BME),
[emMorph / e-magyar](https://e-magyar.hu/hu/textmodules/emmorph),
[hunmorph](http://mokk.bme.hu/resources/hunmorph/), and
[multilingual-inflection](https://github.com/tomsouri/multilingual-inflection)
(Sourada & Straka, 2025 — training recipe reference).
