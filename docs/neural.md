# Neural fallback: setup per environment

The optional `@i18n-inflect/neural` package runs a tiny (~2 MB int8) char-level
seq2seq model to inflect words the rules were unsure about. It talks to a
**swappable inference engine** — three adapters ship, and anything implementing
the 3-method `InferenceEngine` interface works.

```
┌──────────────┐   FallbackRequest[]   ┌───────────────────┐    ┌─────────────────────┐
│ i18n-inflect │ ────────────────────► │ @i18n-inflect/    │ ─► │ InferenceEngine      │
│  (rules)     │ ◄──────────────────── │ neural (decode)   │    │  · ort-web (WASM)    │
└──────────────┘   inflected forms     └───────────────────┘    │  · ort-node          │
                                                                │  · boogie-onnx (📱)  │
                                                                └─────────────────────┘
```

Engine autodetection order: `globalThis.boogieOnnx` (Cordova native bridge) →
Node (`onnxruntime-node`) → browser (`onnxruntime-web`).

## Browser (onnxruntime-web)

```sh
npm i @i18n-inflect/neural @i18n-inflect/model-hu onnxruntime-web
```

```ts
import { registerFallback, preload } from "i18n-inflect";
import { createNeuralFallback } from "@i18n-inflect/neural";
import { loadModelHu } from "@i18n-inflect/model-hu";

registerFallback(createNeuralFallback({ model: await loadModelHu() }));
await preload("hu"); // optional: create the WASM session up front
```

Notes: onnxruntime-web's own WASM binaries are an order of magnitude larger than the
model — lazy-load this whole setup behind a dynamic `import()` and let your bundler
serve model assets (`loadModelHu({ baseUrl })` if you host them elsewhere, e.g. a CDN
or the Hugging Face Hub).

## Node.js (onnxruntime-node)

```sh
npm i @i18n-inflect/neural @i18n-inflect/model-hu onnxruntime-node
```

Same code as the browser — the engine is autodetected; model assets resolve to file
paths automatically.

## Cordova (cordova-plugin-boogie-onnx) 📱

The [native bridge](https://github.com/boogie/cordova-plugin-boogie-onnx) runs the
model with platform-native ONNX Runtime (NNAPI/XNNPACK on Android, CoreML on iOS)
instead of single-threaded WASM in the WebView — correct numerics and much better
speed. No extra npm dependency: the adapter talks to the global `boogieOnnx`.

```sh
cordova plugin add https://github.com/boogie/cordova-plugin-boogie-onnx.git
```

```ts
import { registerFallback } from "i18n-inflect";
import { createNeuralFallback } from "@i18n-inflect/neural";
import { boogieOnnxEngine } from "@i18n-inflect/neural/boogie-onnx";
import { loadModelHu } from "@i18n-inflect/model-hu";

// After deviceready. The native side loads models BY FILE PATH — ship the
// assets with your app (or download them) and pass their on-device paths.
const model = await loadModelHu({
  paths: {
    encoder: `${cordova.file.applicationDirectory}www/models/hu/encoder_int8.onnx`,
    decoderStep: `${cordova.file.applicationDirectory}www/models/hu/decoder_step_int8.onnx`,
    vocab: `${cordova.file.applicationDirectory}www/models/hu/vocab.json`,
  },
});
registerFallback(
  createNeuralFallback({ model, engine: boogieOnnxEngine({ device: "auto" }) }),
);
```

(Omitting `engine:` also works — the presence of `globalThis.boogieOnnx` selects the
bridge automatically; passing it explicitly lets you set `device`.)

## Bring your own engine

Not married to ONNX. Implement three methods and pass it as `engine:`:

```ts
import type { InferenceEngine } from "@i18n-inflect/neural";

const myEngine: InferenceEngine = {
  async createSession(model) {
    return {
      inputNames: [...], outputNames: [...],
      async run(feeds) { /* {type,data,dims} tensors in and out */ },
      async release() {},
    };
  },
};
```

The model contract the runtime expects (produced by `training/export_onnx.py`):

| Graph | Inputs | Output |
| --- | --- | --- |
| `encoder` | `src` int64 `[B,S]` | `memory` float32 `[B,S,D]` |
| `decoder_step` | `memory`, `src`, `tgt` int64 `[B,T]` | `logits` float32 `[B,T,V]` |

Decoding is greedy, batched, cache-less (word-length sequences), implemented in JS
(`greedyDecodeBatch`) — the engine only executes the graphs. A future dependency-free
pure-JS int8 decoder can replace ONNX entirely without touching this API.

## How answers flow back

`formatAsync`/`inflectAsync` batch all rule-uncertain words to `predict()`, cache the
answers in the shared oracle, and re-run the (pure, sync) language pack. The cache
means subsequent **synchronous** `format()` calls also return the corrected forms —
see the React recipe in [react.md](react.md).
