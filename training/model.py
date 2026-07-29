"""The inflection model: a small character-level Transformer encoder-decoder.

Sized after the recipe validated by Sourada & Straka (2025, "Flexing in
73 Languages") scaled down for a single language: d_model 192, 2+2 layers,
4 heads, FFN 384 → ~1.5M parameters. Trains in minutes on CPU.

The attention is implemented by hand (plain matmul + softmax + additive
masks) instead of `nn.Transformer`: the built-in module's fast paths and
mask canonicalization bake shapes under the TorchScript tracer and trip
data-dependent guards under `torch.export` — this version exports cleanly
with fully dynamic batch and sequence dimensions.
"""

from __future__ import annotations

import math

import torch
from torch import Tensor, nn

from data import PAD

NEG_INF = -1e9


class PositionalEncoding(nn.Module):
    def __init__(self, d_model: int, max_len: int = 256) -> None:
        super().__init__()
        position = torch.arange(max_len).unsqueeze(1)
        div = torch.exp(torch.arange(0, d_model, 2) * (-math.log(10000.0) / d_model))
        pe = torch.zeros(max_len, d_model)
        pe[:, 0::2] = torch.sin(position * div)
        pe[:, 1::2] = torch.cos(position * div)
        self.register_buffer("pe", pe)

    def forward(self, x: Tensor) -> Tensor:  # x: [B, T, D]
        return x + self.pe[: x.size(1)]


class MultiHeadAttention(nn.Module):
    def __init__(self, d_model: int, nhead: int) -> None:
        super().__init__()
        assert d_model % nhead == 0
        self.nhead = nhead
        self.head_dim = d_model // nhead
        self.q = nn.Linear(d_model, d_model)
        self.k = nn.Linear(d_model, d_model)
        self.v = nn.Linear(d_model, d_model)
        self.o = nn.Linear(d_model, d_model)

    def forward(self, query: Tensor, kv: Tensor, mask: Tensor | None) -> Tensor:
        # query: [B, Tq, D], kv: [B, Tk, D], mask: additive, broadcastable to
        # [B, nhead, Tq, Tk] (or None).
        b, tq, _ = query.shape
        tk = kv.size(1)
        q = self.q(query).view(b, tq, self.nhead, self.head_dim).transpose(1, 2)
        k = self.k(kv).view(b, tk, self.nhead, self.head_dim).transpose(1, 2)
        v = self.v(kv).view(b, tk, self.nhead, self.head_dim).transpose(1, 2)
        scores = q @ k.transpose(-1, -2) / math.sqrt(self.head_dim)
        if mask is not None:
            scores = scores + mask
        out = (scores.softmax(-1) @ v).transpose(1, 2).reshape(b, tq, -1)
        return self.o(out)


class FeedForward(nn.Module):
    def __init__(self, d_model: int, dim_feedforward: int, dropout: float) -> None:
        super().__init__()
        self.net = nn.Sequential(
            nn.Linear(d_model, dim_feedforward),
            nn.ReLU(),
            nn.Dropout(dropout),
            nn.Linear(dim_feedforward, d_model),
        )

    def forward(self, x: Tensor) -> Tensor:
        return self.net(x)


class EncoderLayer(nn.Module):
    def __init__(self, d_model: int, nhead: int, dim_feedforward: int, dropout: float) -> None:
        super().__init__()
        self.attn = MultiHeadAttention(d_model, nhead)
        self.ffn = FeedForward(d_model, dim_feedforward, dropout)
        self.norm1 = nn.LayerNorm(d_model)
        self.norm2 = nn.LayerNorm(d_model)
        self.dropout = nn.Dropout(dropout)

    def forward(self, x: Tensor, mask: Tensor | None) -> Tensor:
        x = self.norm1(x + self.dropout(self.attn(x, x, mask)))
        return self.norm2(x + self.dropout(self.ffn(x)))


class DecoderLayer(nn.Module):
    def __init__(self, d_model: int, nhead: int, dim_feedforward: int, dropout: float) -> None:
        super().__init__()
        self.self_attn = MultiHeadAttention(d_model, nhead)
        self.cross_attn = MultiHeadAttention(d_model, nhead)
        self.ffn = FeedForward(d_model, dim_feedforward, dropout)
        self.norm1 = nn.LayerNorm(d_model)
        self.norm2 = nn.LayerNorm(d_model)
        self.norm3 = nn.LayerNorm(d_model)
        self.dropout = nn.Dropout(dropout)

    def forward(self, y: Tensor, memory: Tensor, self_mask: Tensor, cross_mask: Tensor) -> Tensor:
        y = self.norm1(y + self.dropout(self.self_attn(y, y, self_mask)))
        y = self.norm2(y + self.dropout(self.cross_attn(y, memory, cross_mask)))
        return self.norm3(y + self.dropout(self.ffn(y)))


def padding_mask(tokens: Tensor) -> Tensor:
    """Additive mask [B, 1, 1, T] hiding PAD positions as attention keys."""
    return tokens.eq(PAD).float().mul(NEG_INF).unsqueeze(1).unsqueeze(2)


class InflectionModel(nn.Module):
    def __init__(
        self,
        vocab_size: int,
        d_model: int = 192,
        nhead: int = 4,
        num_layers: int = 2,
        dim_feedforward: int = 384,
        dropout: float = 0.1,
    ) -> None:
        super().__init__()
        self.embed = nn.Embedding(vocab_size, d_model, padding_idx=PAD)
        self.pos = PositionalEncoding(d_model)
        self.encoder = nn.ModuleList(
            EncoderLayer(d_model, nhead, dim_feedforward, dropout) for _ in range(num_layers)
        )
        self.decoder = nn.ModuleList(
            DecoderLayer(d_model, nhead, dim_feedforward, dropout) for _ in range(num_layers)
        )
        self.out = nn.Linear(d_model, vocab_size)
        self.d_model = d_model

    # -- training forward (teacher forcing) --------------------------------
    def forward(self, src: Tensor, tgt_in: Tensor) -> Tensor:
        return self.decode_step(self.encode(src), src, tgt_in)

    # -- the two graphs exported to ONNX -----------------------------------
    def encode(self, src: Tensor) -> Tensor:
        x = self.pos(self.embed(src) * math.sqrt(self.d_model))
        mask = padding_mask(src)
        for layer in self.encoder:
            x = layer(x, mask)
        return x

    def decode_step(self, memory: Tensor, src: Tensor, tgt_in: Tensor) -> Tensor:
        y = self.pos(self.embed(tgt_in) * math.sqrt(self.d_model))
        t = tgt_in.size(1)
        causal = torch.full((t, t), NEG_INF, device=tgt_in.device).triu(1)
        self_mask = causal + padding_mask(tgt_in)
        cross_mask = padding_mask(src)
        for layer in self.decoder:
            y = layer(y, memory, self_mask, cross_mask)
        return self.out(y)


class EncoderExport(nn.Module):
    """ONNX wrapper: src [B,S] int64 → memory [B,S,D] float32."""

    def __init__(self, model: InflectionModel) -> None:
        super().__init__()
        self.model = model

    def forward(self, src: Tensor) -> Tensor:
        return self.model.encode(src)


class DecoderStepExport(nn.Module):
    """ONNX wrapper: memory, src, tgt [B,T] int64 → logits [B,T,V] float32."""

    def __init__(self, model: InflectionModel) -> None:
        super().__init__()
        self.model = model

    def forward(self, memory: Tensor, src: Tensor, tgt: Tensor) -> Tensor:
        return self.model.decode_step(memory, src, tgt)
