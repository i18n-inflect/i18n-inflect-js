# Neural model training

PyTorch → ONNX pipeline for the per-language inflection models
(`@i18n-inflect/model-*`). Architecture: character-level Transformer
encoder-decoder (~1.5M parameters — d_model 192, 2+2 layers, 4 heads), following
the recipe validated by [Sourada & Straka 2025, "Flexing in 73 Languages"](https://arxiv.org/abs/2510.23114)
(SIGMORPHON 2023 1st place on average), scaled to a single language.

## Prerequisites

- [uv](https://docs.astral.sh/uv/) (Python 3.11+)
- training TSVs from the JS data pipeline: `pnpm pipeline:hu` at the repo root
  (writes `data/training/hu.{train,dev,test}.tsv`)

## Steps

```sh
uv sync
uv run train.py --lang hu                 # ~minutes; MPS/CUDA used when available
uv run export_onnx.py --lang hu           # encoder.onnx + decoder_step.onnx + parity check
uv run quantize.py --lang hu              # int8: *_int8.onnx (the shipped artifacts)
uv run evaluate.py --lang hu --int8       # exact-match on the held-out test split → meta.json
```

Smoke run (CI or quick iteration): `uv run train.py --lang hu --max-rows 40000 --epochs 3`.

Outputs land in `out/<lang>/` (gitignored). The `models.yml` workflow packages
`encoder_int8.onnx`, `decoder_step_int8.onnx`, `vocab.json` and `meta.json` into the
`@i18n-inflect/model-<lang>` assets — weights are UniMorph derivatives (CC BY-SA 3.0,
see ../LICENSE-DATA.md).

## Contracts with the JS runtime

- `vocab.json` = `{ pad, bos, eos, sep, unk, tokens }` — ids must match
  `@i18n-inflect/neural`'s `Vocab` exactly (they are emitted from the same file).
- Graph I/O names and shapes are fixed: `encoder(src[B,S] int64) → memory[B,S,D]`,
  `decoder_step(memory, src, tgt[B,T]) → logits[B,T,V]`.
- Input encoding: tag segments + `<sep>` + lemma characters; greedy decode with a
  `src_len + 12` budget. Data hallucination (`--hallucinate 0.3`) teaches the model
  to copy unknown stems — the whole point of the fallback.
