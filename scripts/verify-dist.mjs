/**
 * Verifies the BUILT artifacts, not the sources.
 *
 * The library keeps mutable state in module scope: a language pack registers
 * itself into the core registry as a side effect of importing its subpath.
 * That only works if the subpath entry and the main entry share one instance
 * of the core. Bundling each entry standalone silently breaks it — every
 * `inflect()` call returns its input unchanged, with no error — and no
 * source-level test can catch it, because in the sources there is only ever
 * one module instance.
 *
 * This script therefore exercises the real dist output through both module
 * systems. Run it after `pnpm build`; CI runs it on every push.
 */
import { createRequire } from "node:module";

const DIST = new URL("../packages/i18n-inflect/dist/", import.meta.url);
const require = createRequire(import.meta.url);

/** [locale, phrase, features, expected] */
const CASES = [
  ["hu", "kőr ász", { case: "instrumental" }, "kőr ásszal"],
  ["hu", "ház", { number: "plural", case: "inessive" }, "házakban"],
  ["hu", "6", { case: "accusative" }, "6-ot"],
  ["en", "a ace", {}, "an ace"],
  ["ko", "책", { case: "topic" }, "책은"],
  ["de", "Krankenhaus", { number: "plural" }, "Krankenhäuser"],
  ["de", "Haus", { article: "definite" }, "das Haus"],
  ["es", "agua", { article: "definite" }, "el agua"],
  ["it", "zaino", { article: "definite" }, "lo zaino"],
  ["pt", "cidade", { case: "dative" }, "à cidade"],
  ["tr", "kitap", { case: "accusative" }, "kitabı"],
  ["pl", "nowy dom", { case: "inessive" }, "nowym domu"],
  ["ru", "красивый стол", { case: "genitive" }, "красивого стола"],
];
const LANGS = ["hu", "en", "de", "fr", "es", "it", "pt", "ko", "tr", "pl", "ru"];

let failures = 0;

function check(label, got, expected) {
  const ok = got === expected;
  if (!ok) failures++;
  console.log(
    `  ${ok ? "✔" : "✘"} ${label}: ${JSON.stringify(got)}${ok ? "" : ` (expected ${JSON.stringify(expected)})`}`,
  );
}

// ---- ESM ----
console.log("ESM (import):");
{
  const core = await import(new URL("index.js", DIST));
  for (const lang of LANGS) await import(new URL(`${lang}/index.js`, DIST));
  const registered = core.registeredLocales().sort();
  check("registered locales", registered.join(","), LANGS.slice().sort().join(","));
  for (const [locale, phrase, features, expected] of CASES) {
    check(`${locale} ${phrase}`, core.inflect(locale, phrase, features), expected);
  }
}

// ---- CJS ----
console.log("CJS (require):");
{
  const core = require(new URL("index.cjs", DIST).pathname);
  for (const lang of LANGS) require(new URL(`${lang}/index.cjs`, DIST).pathname);
  const registered = core.registeredLocales().sort();
  check("registered locales", registered.join(","), LANGS.slice().sort().join(","));
  for (const [locale, phrase, features, expected] of CASES) {
    check(`${locale} ${phrase}`, core.inflect(locale, phrase, features), expected);
  }
}

// ---- the two module systems must not disagree ----
console.log("Cross-format:");
{
  const esm = await import(new URL("index.js", DIST));
  const cjs = require(new URL("index.cjs", DIST).pathname);
  check(
    "same answer from both",
    `${esm.inflect("hu", "busz", { case: "instrumental" })}|${cjs.inflect("hu", "busz", { case: "instrumental" })}`,
    "busszal|busszal",
  );
}

if (failures > 0) {
  console.error(`\n${failures} check(s) failed — the built package is broken.`);
  process.exit(1);
}
console.log("\nbuilt artifacts verified ✔");
