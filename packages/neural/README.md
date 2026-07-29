# @i18n-inflect/neural

Optional neural inflection fallback for [i18n-inflect](https://github.com/i18n-inflect/i18n-inflect-js):
runs a tiny (~2 MB int8) character-level seq2seq model to inflect out-of-vocabulary
words the rule engine was unsure about.

- **Swappable inference engine** — three adapters ship:
  - `@i18n-inflect/neural/ort-web` (browser, onnxruntime-web WASM)
  - `@i18n-inflect/neural/ort-node` (Node, onnxruntime-node)
  - `@i18n-inflect/neural/boogie-onnx` (Cordova, native ONNX Runtime via
    [`cordova-plugin-boogie-onnx`](https://github.com/boogie/cordova-plugin-boogie-onnx) — zero JS deps)
- Autodetected, or bring your own by implementing the 3-method `InferenceEngine` interface.
- `onnxruntime-*` packages are *optional* peers — install only what your platform uses.

```ts
import { registerFallback, preload } from "i18n-inflect";
import { createNeuralFallback } from "@i18n-inflect/neural";
import { loadModelHu } from "@i18n-inflect/model-hu";

registerFallback(createNeuralFallback({ model: await loadModelHu() }));
await preload("hu");
```

Full environment-by-environment guide:
[docs/neural.md](https://github.com/i18n-inflect/i18n-inflect-js/blob/main/docs/neural.md).

MIT licensed.
