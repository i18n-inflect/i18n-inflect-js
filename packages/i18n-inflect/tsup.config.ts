import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    index: "src/index.ts",
    "hu/index": "src/hu/index.ts",
    "en/index": "src/en/index.ts",
    "de/index": "src/de/index.ts",
    "fr/index": "src/fr/index.ts",
    "es/index": "src/es/index.ts",
    "it/index": "src/it/index.ts",
    "ko/index": "src/ko/index.ts",
    "pl/index": "src/pl/index.ts",
    "pt/index": "src/pt/index.ts",
    "ru/index": "src/ru/index.ts",
    "tr/index": "src/tr/index.ts",
  },
  format: ["esm", "cjs"],
  dts: true,
  sourcemap: true,
  clean: true,
  target: "es2022",
  treeshake: true,
  // Shared chunks in BOTH formats: without this, each CJS entry bundles its
  // own copy of the registry, so `require("i18n-inflect/hu")` would register
  // into a different Map than `require("i18n-inflect")` reads.
  splitting: true,
});
