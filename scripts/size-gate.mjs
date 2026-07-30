/**
 * Bundle-size gates: each entry is bundled + minified with esbuild (as an
 * application bundler would) and its gzip size compared to the budget.
 * Language budgets INCLUDE the core they pull in.
 *
 * Run `pnpm build` first — gates operate on dist output.
 */
import { gzipSync } from "node:zlib";
import { build } from "esbuild";

const GATES = [
  { name: "core", entry: "packages/i18n-inflect/dist/index.js", budget: 8 * 1024 },
  // Hungarian carries a generated lexicon covering ~17k noun lemmas from
  // UniMorph and Wiktionary combined — vocabulary is what turns "most words"
  // into "the words you will actually use". The budget is a ceiling, not a
  // ratchet: it has moved twice, each time for a documented gain in
  // coverage, and must not move to accommodate drift.
  { name: "hu", entry: "packages/i18n-inflect/dist/hu/index.js", budget: 200 * 1024 },
  { name: "en", entry: "packages/i18n-inflect/dist/en/index.js", budget: 8 * 1024 },
  { name: "de", entry: "packages/i18n-inflect/dist/de/index.js", budget: 8 * 1024 },
  { name: "fr", entry: "packages/i18n-inflect/dist/fr/index.js", budget: 8 * 1024 },
  // Spanish and Italian carry generated gender and plural lexicons: gender
  // is lexical in both, and making callers pass it on every call is work a
  // library should absorb.
  { name: "es", entry: "packages/i18n-inflect/dist/es/index.js", budget: 40 * 1024 },
  { name: "it", entry: "packages/i18n-inflect/dist/it/index.js", budget: 60 * 1024 },
  { name: "ko", entry: "packages/i18n-inflect/dist/ko/index.js", budget: 8 * 1024 },
  { name: "neural", entry: "packages/neural/dist/index.js", budget: 8 * 1024 },
];

let failed = false;
for (const gate of GATES) {
  const result = await build({
    entryPoints: [gate.entry],
    bundle: true,
    minify: true,
    format: "esm",
    write: false,
    external: ["onnxruntime-web", "onnxruntime-node"],
    logLevel: "silent",
  });
  const gz = gzipSync(result.outputFiles[0].contents).length;
  const ok = gz <= gate.budget;
  if (!ok) failed = true;
  console.log(
    `${ok ? "✔" : "✘"} ${gate.name.padEnd(7)} ${(gz / 1024).toFixed(1).padStart(6)} kB gz` +
      ` (budget ${(gate.budget / 1024).toFixed(0)} kB)`,
  );
}
process.exit(failed ? 1 : 0);
