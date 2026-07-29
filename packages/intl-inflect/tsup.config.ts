import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    index: "src/index.ts",
    "hu/index": "src/hu/index.ts",
    "en/index": "src/en/index.ts",
    "de/index": "src/de/index.ts",
    "fr/index": "src/fr/index.ts",
    "es/index": "src/es/index.ts",
    "ko/index": "src/ko/index.ts",
  },
  format: ["esm", "cjs"],
  dts: true,
  sourcemap: true,
  clean: true,
  target: "es2022",
  treeshake: true,
});
