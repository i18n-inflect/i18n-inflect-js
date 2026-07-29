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
  { name: "core", entry: "packages/intl-inflect/dist/index.js", budget: 8 * 1024 },
  { name: "hu", entry: "packages/intl-inflect/dist/hu/index.js", budget: 25 * 1024 },
  { name: "en", entry: "packages/intl-inflect/dist/en/index.js", budget: 8 * 1024 },
  { name: "de", entry: "packages/intl-inflect/dist/de/index.js", budget: 8 * 1024 },
  { name: "fr", entry: "packages/intl-inflect/dist/fr/index.js", budget: 8 * 1024 },
  { name: "es", entry: "packages/intl-inflect/dist/es/index.js", budget: 8 * 1024 },
  { name: "ko", entry: "packages/intl-inflect/dist/ko/index.js", budget: 8 * 1024 },
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
