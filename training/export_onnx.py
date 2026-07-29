"""Export the trained model as the two ONNX graphs the JS runtime consumes.

    uv run export_onnx.py --lang hu

Reads `out/<lang>/model.pt` + `out/<lang>/vocab.json`, writes
`out/<lang>/encoder.onnx` and `out/<lang>/decoder_step.onnx` with the exact
input/output names `@intl-inflect/neural` expects, then sanity-checks both
graphs with onnxruntime against PyTorch — across *different* batch sizes
and sequence lengths, because baked-in shapes are the classic export bug
(the legacy TorchScript tracer bakes attention reshapes; the dynamo
exporter used here keeps them dynamic).
"""

from __future__ import annotations

import argparse
from pathlib import Path

import numpy as np
import onnxruntime as ort
import torch

from data import Vocab
from model import DecoderStepExport, EncoderExport, InflectionModel

OPSET = 18


def export(module: torch.nn.Module, args: tuple, path: Path, names: dict) -> None:
    torch.onnx.export(
        module,
        args,
        str(path),
        input_names=names["inputs"],
        output_names=names["outputs"],
        dynamic_shapes=names["dynamic"],
        opset_version=OPSET,
        dynamo=True,
        external_data=False,
    )


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--lang", default="hu")
    args = ap.parse_args()

    out_dir = Path(__file__).resolve().parent / "out" / args.lang
    vocab = Vocab.load(out_dir / "vocab.json")
    model = InflectionModel(vocab.size)
    model.load_state_dict(torch.load(out_dir / "model.pt", map_location="cpu"))
    model.eval()

    batch = torch.export.Dim("batch", min=1, max=256)
    src_len = torch.export.Dim("src_len", min=2, max=128)
    tgt_len = torch.export.Dim("tgt_len", min=1, max=128)

    src = torch.randint(5, vocab.size, (2, 11), dtype=torch.long)
    tgt = torch.randint(5, vocab.size, (2, 7), dtype=torch.long)

    # The export wrappers must be eval()'d themselves: torch.onnx.export
    # restores the WRAPPER's mode on exit — recursively, flipping the inner
    # model's dropout back to training if the wrapper defaulted there.
    encoder = EncoderExport(model).eval()
    with torch.no_grad():
        memory = encoder(src)
    export(
        encoder,
        (src,),
        out_dir / "encoder.onnx",
        {
            "inputs": ["src"],
            "outputs": ["memory"],
            "dynamic": {"src": {0: batch, 1: src_len}},
        },
    )

    decoder = DecoderStepExport(model).eval()
    export(
        decoder,
        (memory, src, tgt),
        out_dir / "decoder_step.onnx",
        {
            "inputs": ["memory", "src", "tgt"],
            "outputs": ["logits"],
            "dynamic": {
                "memory": {0: batch, 1: src_len},
                "src": {0: batch, 1: src_len},
                "tgt": {0: batch, 1: tgt_len},
            },
        },
    )

    # Parity check across shapes DIFFERENT from the export examples.
    encoder.eval()
    decoder.eval()
    enc_session = ort.InferenceSession(str(out_dir / "encoder.onnx"))
    dec_session = ort.InferenceSession(str(out_dir / "decoder_step.onnx"))
    for b, s, t in [(2, 11, 7), (1, 8, 5), (3, 15, 9)]:
        src_i = torch.randint(5, vocab.size, (b, s), dtype=torch.long)
        tgt_i = torch.randint(5, vocab.size, (b, t), dtype=torch.long)
        with torch.no_grad():
            memory_i = encoder(src_i)
            torch_logits = decoder(memory_i, src_i, tgt_i).numpy()
        onnx_memory = enc_session.run(None, {"src": src_i.numpy()})[0]
        np.testing.assert_allclose(memory_i.numpy(), onnx_memory, rtol=1e-3, atol=1e-3)
        onnx_logits = dec_session.run(
            None, {"memory": onnx_memory, "src": src_i.numpy(), "tgt": tgt_i.numpy()}
        )[0]
        np.testing.assert_allclose(torch_logits, onnx_logits, rtol=1e-3, atol=1e-3)
        print(f"parity ok: batch={b} src_len={s} tgt_len={t}")
    print(f"exported + verified: {out_dir}/encoder.onnx, {out_dir}/decoder_step.onnx")


if __name__ == "__main__":
    main()
