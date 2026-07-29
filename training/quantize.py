"""Dynamic int8 quantization of the exported graphs.

    uv run quantize.py --lang hu

Writes `out/<lang>/encoder_int8.onnx` and `out/<lang>/decoder_step_int8.onnx`
(the artifacts `@intl-inflect/model-<lang>` ships) and prints the size drop.
"""

from __future__ import annotations

import argparse
from pathlib import Path

from onnxruntime.quantization import QuantType, quantize_dynamic


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--lang", default="hu")
    args = ap.parse_args()

    out_dir = Path(__file__).resolve().parent / "out" / args.lang
    for name in ("encoder", "decoder_step"):
        src = out_dir / f"{name}.onnx"
        dst = out_dir / f"{name}_int8.onnx"
        quantize_dynamic(src, dst, weight_type=QuantType.QInt8)
        print(f"{name}: {src.stat().st_size / 1e6:.2f} MB → {dst.stat().st_size / 1e6:.2f} MB")


if __name__ == "__main__":
    main()
