# @intl-inflect/model-hu

Hungarian neural inflection model for
[intl-inflect](https://github.com/boogie/intl-inflect-js): a ~2 MB int8
character-level seq2seq (encoder + decoder ONNX graphs + shared vocab), trained on
[UniMorph](https://github.com/unimorph/hun) by the repository's training pipeline.

```ts
import { createNeuralFallback } from "@intl-inflect/neural";
import { loadModelHu } from "@intl-inflect/model-hu";
import { registerFallback } from "intl-inflect";

registerFallback(createNeuralFallback({ model: await loadModelHu() }));
```

`loadModelHu()` resolves the bundled assets automatically in Node and bundler
environments; pass `{ baseUrl }` to serve them from a CDN, or `{ paths }` for
on-device files (Cordova native engine).

Licensing: loader code MIT; the model weights are UniMorph/Wiktionary derivatives —
**CC BY-SA 3.0** (see the repository's LICENSE-DATA.md).
