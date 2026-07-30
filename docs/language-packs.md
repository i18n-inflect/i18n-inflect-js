# Writing a language pack

See what the existing packs produce in the [playground](https://i18n-inflect.github.io/i18n-inflect-js/).

A language pack is a pure, synchronous module implementing the `LanguagePack`
interface. Importing its subpath registers it; everything asynchronous (the neural
fallback protocol, caching) lives in core — packs never see a Promise.

## The contract

```ts
import type { LanguagePack } from "i18n-inflect";
import { registerLanguage } from "i18n-inflect";

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

**Validate what comes back.** A fallback is a statistical model being asked about
words it may never have seen, and one bad answer would be cached and then served to
every later synchronous call. Core rejects empty and implausibly long answers; add
`acceptFallback(request, answer)` to your pack for language-specific plausibility:

```ts
acceptFallback(request, answer) {
  // Hungarian suffixation keeps the word's opening intact, so an answer
  // that starts elsewhere is a hallucination, not an inflection.
  return foldAccents(answer).startsWith(foldAccents(request.lemma).slice(0, 3));
}
```

Rejected answers are reported as `fallback-rejected` warnings and the rule-based
form is kept.

**Prefer rules over the model wherever the problem is actually closed.** Hungarian
number and initialism suffixation ("6-ot", "SMS-t") looks like a job for the neural
fallback, but it is fully rule-derivable once you spell the token's spoken form —
see `hu/numerals.ts`. Rules are exact, need no download, and work synchronously.

## Gender is lexical — get it from data, not from the caller

Spanish and Italian hang their agreement on gender, and the endings everyone
teaches are wrong often enough to matter: `el mapa`, `la mano`, `il
problema`, `la foto`. Requiring `gender` on every call pushes that work onto
the application. `data-pipeline/run-nouns.ts` extracts gender from
Wiktionary and stores **only the nouns whose ending misleads** — 2,736 of
58,492 for Spanish, 4,359 of 59,752 for Italian — which keeps the lexicon
small and, more usefully, measures how good the heuristic actually is.

One spelling can be two words: `o coração` (heart) and `a coração`
(blushing), `der Tag` (day) and the borrowed `das Tag`. The string cannot say
which is meant, so the pipeline keeps the **better-attested** reading — the
entry with more senses — and the caller's `gender` covers the other. An
earlier version dropped both, which is defensible but loses the common word
along with the rare one.

## Compounds are the cheapest vocabulary you will ever get

German gender rules look weak — 75.5% from the endings alone — until you
notice what fixes them. A German compound takes the gender and the plural of
its **last** element: `Krankenhaus` is a `Haus`, `Übersetzungswörterbuch` is
a `Buch`, `Waffenstillstand` is a `Stand`. Resolving the head before falling
back to the ending heuristic lifts gender to 88.1% and plural to 91.2%
*without storing a single compound* — and it answers for compounds no
dictionary lists, which is most of them, because German makes new ones freely.

Two details make it work rather than backfire:

- **Derivational suffixes outrank the head.** `Abbildung` is not a kind of
  `Dung`, however convincingly it ends in one — `-ung` has already decided.
  So the exceptionless suffix classes are consulted *before* the head.
- **Some words are bad heads, and the corpus knows which.** `Ufer` turns
  every `-läufer` neuter; `Feuer` turns every `-steuer` neuter. Each candidate
  head is scored on the compounds it would answer for, and the ones that lose
  more than they win are blocked. That is worth 0.5 points of held-out
  accuracy — small, but it is 0.5 points of *wrong answers to unlisted words*,
  which is the kind that reaches users.

The same shape applies to Hungarian (`kávéház` → `kávéházat`). Where a
language compounds productively, resolve the head before you store anything.

## Two sources beat one

The Hungarian lexicon is built from UniMorph *and* the current Wiktionary
(through the wiktextract dumps at kaikki.org). Merging them added 40% more
vocabulary, but the more valuable result was the cross-check: where both
describe the same form they agree 99.8% of the time, which is evidence
neither source alone could give. `data-pipeline/compare-sources.ts` prints
that comparison — run it before adopting any new source, and look at the
disagreements, not just the headline number.

The dump is 580 MB and is not required to build the package: the generated
lexicon is committed, and the pipeline falls back to UniMorph alone when the
file is absent.

## Test against the authority, not only the corpus

A corpus tells you what people wrote; a style authority tells you what is
correct, and its worked examples are free, high-quality test material. The
Hungarian pack asserts every example from rule 82 of the Academy's
orthography (`test/hu.akh.test.ts`) alongside the corpus-derived fixtures.
Where the two disagree, say so in a comment rather than silently picking.

Expect to find cases that are undecidable without context — homonyms whose
readings inflect differently, or spellings the authority explicitly allows
in more than one form. Encode the commoner choice, document it, and leave
the caller a way to override it (`seedOracle`).

## Generated data

If your language needs an exception lexicon, generate it — don't hand-write it.
The pattern (see `data-pipeline/`): run your rules against a corpus (UniMorph),
explain mismatching lemmas with the *smallest* per-lemma property that fixes the
whole paradigm, and store only the residue as full forms. Generated files carry the
data license in their header (see `LICENSE-DATA.md`) and a gzip size budget is
enforced at generation time.

For a language with a large paradigm, do not search the property space — fit
it. Polish has seven cases in two numbers and Russian six, but the cells are
not independent: each *choice* a noun makes (is the masculine genitive `-a`
or `-u`, does the accusative copy the genitive, how is the nominative plural
formed) governs its own cells and no others. So each slot can be read
straight off the attested form, one at a time, instead of searched in
combination — linear rather than exponential, and the result is a paradigm
signature a few characters long:

```
niemiec|s niemc,A,P          # oblique stem, animate, personal
buch|uer                     # umlauted stem, -er plural
```

Some things are not spelling facts at all. Slavic animacy — whether the
accusative copies the nominative or the genitive — depends on whether the
noun names something alive, and no amount of phonology will tell you. Store
it as a flag, and have the pack ask the fallback when it has to guess.

## Report the honest number

A lexicon built from a corpus scores 100% on that corpus by construction.
That number means nothing. Every pipeline here holds back a deterministic
tenth of the lemmas, builds from the rest, and reports accuracy on the part
it never saw — which is what a user's vocabulary looks like:

```
Polish: 7190 lemmas, 95686 cells
  rules alone:      86.63%
  rules + lexicon:  100.00%
  held out (723 unseen lemmas): 85.59%
```

The gap between the second and third lines is exactly what the neural
fallback exists to close. Print both, and never quote the middle one on its
own.

## Checklist for a new pack

1. `src/<lang>/index.ts` implementing + registering the pack.
2. Subpath export in `package.json` (`"./<lang>"`) **and** an entry in `sideEffects`
   (the registration import must survive tree-shaking).
3. Entry in `tsup.config.ts`.
4. Unit table tests for the phonology/orthography helpers; phrase-level tests
   through the public `inflect()`/`format()`.
5. If corpus-backed: pipeline step + golden fixtures + accuracy gate.
