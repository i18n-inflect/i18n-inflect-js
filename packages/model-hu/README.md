# @i18n-inflect/model-hu

Hungarian neural inflection model for
[i18n-inflect](https://github.com/i18n-inflect/i18n-inflect-js): a ~2 MB int8
character-level seq2seq (encoder + decoder ONNX graphs + shared vocab), trained on
[UniMorph](https://github.com/unimorph/hun) by the repository's training pipeline.

```ts
import { createNeuralFallback } from "@i18n-inflect/neural";
import { loadModelHu } from "@i18n-inflect/model-hu";
import { registerFallback } from "i18n-inflect";

registerFallback(createNeuralFallback({ model: await loadModelHu() }));
```

`loadModelHu()` resolves the bundled assets automatically in Node and bundler
environments; pass `{ baseUrl }` to serve them from a CDN, or `{ paths }` for
on-device files (Cordova native engine).

> **Not published yet.** The weights are produced by the repository's models
> workflow rather than stored in git, so this package stays unpublished until
> that workflow attaches release artifacts. Build it locally by running the
> training pipeline in [`training/`](../../training/README.md) and copying
> `training/out/hu/{encoder_int8.onnx,decoder_step_int8.onnx,vocab.json,meta.json}`
> into `assets/`.

Licensing: loader code MIT; the model weights are UniMorph/Wiktionary derivatives —
**CC BY-SA 3.0** (see the repository's LICENSE-DATA.md).
