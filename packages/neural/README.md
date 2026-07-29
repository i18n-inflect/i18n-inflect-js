# @intl-inflect/neural

Optional neural inflection fallback for [intl-inflect](https://github.com/boogie/intl-inflect-js):
runs a tiny (~2 MB int8) character-level seq2seq model to inflect out-of-vocabulary
words the rule engine was unsure about.

- **Swappable inference engine** — three adapters ship:
  - `@intl-inflect/neural/ort-web` (browser, onnxruntime-web WASM)
  - `@intl-inflect/neural/ort-node` (Node, onnxruntime-node)
  - `@intl-inflect/neural/boogie-onnx` (Cordova, native ONNX Runtime via
    [`cordova-plugin-boogie-onnx`](https://github.com/boogie/cordova-plugin-boogie-onnx) — zero JS deps)
- Autodetected, or bring your own by implementing the 3-method `InferenceEngine` interface.
- `onnxruntime-*` packages are *optional* peers — install only what your platform uses.

```ts
import { registerFallback, preload } from "intl-inflect";
import { createNeuralFallback } from "@intl-inflect/neural";
import { loadModelHu } from "@intl-inflect/model-hu";

registerFallback(createNeuralFallback({ model: await loadModelHu() }));
await preload("hu");
```

Full environment-by-environment guide:
[docs/neural.md](https://github.com/boogie/intl-inflect-js/blob/main/docs/neural.md).

MIT licensed.
