"""Evaluate exported ONNX graphs on the held-out test split.

    uv run evaluate.py --lang hu [--int8]

Runs the same greedy decode the JS runtime performs, reports exact-match
accuracy, and writes `out/<lang>/meta.json` (the models workflow's gate
compares against the recorded baseline).
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

import numpy as np
import onnxruntime as ort

from data import BOS, EOS, PAD, Vocab, load_rows

ROOT = Path(__file__).resolve().parent.parent


def greedy(enc: ort.InferenceSession, dec: ort.InferenceSession, vocab: Vocab, lemma: str, tag: str) -> str:
    src_ids = vocab.encode_src(lemma, tag)
    src = np.array([src_ids], dtype=np.int64)
    memory = enc.run(None, {"src": src})[0]
    tgt = [[BOS]]
    inverse = {v: k for k, v in vocab.tokens.items()}
    for _ in range(len(src_ids) + 12):
        logits = dec.run(None, {"memory": memory, "src": src, "tgt": np.array(tgt, dtype=np.int64)})[0]
        next_id = int(logits[0, -1].argmax())
        if next_id == EOS:
            break
        tgt[0].append(next_id)
    else:
        return ""  # runaway generation
    return "".join(inverse.get(t, "") for t in tgt[0][1:] if t not in (PAD, BOS))


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--lang", default="hu")
    ap.add_argument("--int8", action="store_true", help="evaluate the quantized graphs")
    ap.add_argument("--limit", type=int, default=5000)
    args = ap.parse_args()

    out_dir = Path(__file__).resolve().parent / "out" / args.lang
    suffix = "_int8" if args.int8 else ""
    enc = ort.InferenceSession(str(out_dir / f"encoder{suffix}.onnx"))
    dec = ort.InferenceSession(str(out_dir / f"decoder_step{suffix}.onnx"))
    vocab = Vocab.load(out_dir / "vocab.json")

    rows = load_rows(ROOT / "data" / "training" / f"{args.lang}.test.tsv", args.limit)
    correct = sum(1 for r in rows if greedy(enc, dec, vocab, r.lemma, r.tag) == r.form)
    accuracy = correct / len(rows)
    print(f"test exact-match ({'int8' if args.int8 else 'fp32'}, {len(rows)} rows): {accuracy:.2%}")

    meta_path = out_dir / "meta.json"
    meta = json.loads(meta_path.read_text()) if meta_path.exists() else {"locale": args.lang}
    meta[f"accuracy_{'int8' if args.int8 else 'fp32'}"] = round(accuracy, 4)
    meta["testRows"] = len(rows)
    meta_path.write_text(json.dumps(meta, indent=2))
    print(f"wrote {meta_path}")


if __name__ == "__main__":
    main()
