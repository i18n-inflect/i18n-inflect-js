# Contributing

Thanks for considering a contribution. The most valuable ones are **new languages**
and **corrections from native speakers** — if a form comes out wrong in your
language, that is a bug worth reporting even without a fix.

## Getting set up

```sh
pnpm install
pnpm test          # unit + golden tests across packages
pnpm build         # tsup: ESM + CJS + d.ts
pnpm typecheck
pnpm lint          # Biome (use `pnpm lint:fix` to apply)
node scripts/demo.mjs   # see the whole library in action
```

Node ≥ 20 and pnpm 10. The neural training pipeline additionally needs
[uv](https://docs.astral.sh/uv/) — see [training/README.md](training/README.md).

## Reporting a wrong form

Open an issue with the language, the input, what you got and what it should be.
A one-line reproduction is ideal:

```ts
inflect("hu", "kőr ász", { case: "instrumental" }); // got "…", expected "kőr ásszal"
```

Please say which variety you speak if the form is regional or contested — several
languages have more than one accepted answer, and we would rather encode both than
argue about one.

## Adding a language

Read [docs/language-packs.md](docs/language-packs.md) first; it documents the
`LanguagePack` contract, the fallback protocol and the checklist. In short:

1. `packages/i18n-inflect/src/<lang>/index.ts` implementing and registering the pack.
2. Subpath export in `package.json` **and** an entry in its `sideEffects` array —
   the side-effecting registration import must survive tree-shaking.
3. An entry in `tsup.config.ts`.
4. Tests: table tests for the phonology/orthography helpers, plus phrase-level
   tests through the public `inflect()` / `format()`.
5. A size budget in `scripts/size-gate.mjs`.

Two principles worth internalizing before you write rules:

- **Prefer rules to data, and data to models.** Hungarian number suffixation looks
  like a job for the neural fallback, but spelling out the number makes it exact
  and synchronous (`hu/numerals.ts`). Reach for the model only for genuinely open
  vocabulary.
- **Never hand-write an exception lexicon.** Generate it by diffing your rules
  against a corpus and keeping only what the rules get wrong — see
  `data-pipeline/` for the Hungarian implementation. A large diff means the rules
  need work, not that the lexicon needs rows.

## Pull requests

- Add a changeset (`pnpm changeset`) describing the user-visible effect. Skip it
  for docs-only or CI-only changes.
- Keep the tests green, including the golden accuracy gates. If a gate legitimately
  needs to move, say why in the PR.
- Match the surrounding code: comments explain *why* something is the way it is
  (usually a linguistic constraint), never what the next line does.

## Licensing

Code is MIT. Generated lexicons, test fixtures and model weights derive from
UniMorph and are CC BY-SA 3.0 — see [LICENSE-DATA.md](LICENSE-DATA.md). If you
contribute data from another source, say where it came from and under what license
**before** it lands.
