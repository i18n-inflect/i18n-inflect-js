# Writing a language pack

A language pack is a pure, synchronous module implementing the `LanguagePack`
interface. Importing its subpath registers it; everything asynchronous (the neural
fallback protocol, caching) lives in core — packs never see a Promise.

## The contract

```ts
import type { LanguagePack } from "intl-inflect";
import { registerLanguage } from "intl-inflect";

export const xx: LanguagePack = {
  locale: "xx", // primary BCP 47 language subtag
  inflectPhrase(phrase, features, ctx) {
    // 1. tokenize the phrase (helpers: splitPhrase / joinPhrase)
    // 2. inflect the head, agree articles/adjectives, attach particles
    // 3. return { text, confidence }
    return { text: phrase, confidence: "high" };
  },
};

registerLanguage(xx);
```

Rules of the game:

- **Stay pure.** Same inputs + same oracle state ⇒ same output. The async engine
  runs your pack twice (before and after consulting the fallback) and relies on this.
- **Whole-phrase responsibility.** You receive the full interpolated noun phrase.
  Hungarian inflects the *last* word and picks a/az from the *first*; Korean appends
  one particle to the whole phrase; German rewrites article + adjectives. Use
  `splitPhrase`/`joinPhrase`/`splitTrailingPunctuation` from the core to keep
  whitespace and punctuation intact.
- **Degrade, don't throw.** Unsupported feature? `ctx.warn("unknown-feature-value", …)`
  and skip it. Uncertain heuristic? Return `confidence: "low"`.

## The oracle protocol (optional)

When rules can't answer with certainty, consult the shared oracle:

```ts
const request = { lemma: word, tag: "N;ACC;SG" }; // tag format is yours to define
const cached = ctx.lookup(request);
if (cached) return { text: replaceHead(phrase, cached), confidence: "high" };
ctx.requestFallback(request);         // recorded; the async pass resolves it
return { text: bestGuess, confidence: "low" };
```

`inflectAsync`/`formatAsync` batch the recorded requests to the registered
`InflectionFallback` (e.g. the neural model), fill the cache, and re-run your pack.
Because the cache is shared, later *synchronous* calls return the corrected forms.

- Keep `tag` stable and treat it as your lexicon key — the Hungarian pack uses
  UniMorph bundles (`"N;INS;SG"`) so the same tags drive rules, lexicon, golden tests
  and model training.

## Generated data

If your language needs an exception lexicon, generate it — don't hand-write it.
The pattern (see `data-pipeline/`): run your rules against a corpus (UniMorph),
explain mismatching lemmas with the *smallest* per-lemma property that fixes the
whole paradigm, and store only the residue as full forms. Generated files carry the
data license in their header (see `LICENSE-DATA.md`) and a gzip size budget is
enforced at generation time.

## Checklist for a new pack

1. `src/<lang>/index.ts` implementing + registering the pack.
2. Subpath export in `package.json` (`"./<lang>"`) **and** an entry in `sideEffects`
   (the registration import must survive tree-shaking).
3. Entry in `tsup.config.ts`.
4. Unit table tests for the phonology/orthography helpers; phrase-level tests
   through the public `inflect()`/`format()`.
5. If corpus-backed: pipeline step + golden fixtures + accuracy gate.
