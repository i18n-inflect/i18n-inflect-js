import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    index: "src/index.ts",
    "engines/ort-web": "src/engines/ort-web.ts",
    "engines/ort-node": "src/engines/ort-node.ts",
    "engines/boogie-onnx": "src/engines/boogie-onnx.ts",
  },
  format: ["esm", "cjs"],
  dts: true,
  sourcemap: true,
  clean: true,
  target: "es2022",
  external: ["onnxruntime-web", "onnxruntime-node"],
});
