"""Data loading and vocabulary for the inflection model.

Rows come from the TSVs the JS data pipeline emits into `data/training/`
(`lemma \t tag \t form`). The vocabulary — specials, morphological tag
segments and characters — is shared verbatim with the JS runtime through
`vocab.json`, so ids here and in `@intl-inflect/neural` must match exactly.
"""

from __future__ import annotations

import json
import random
from dataclasses import dataclass
from pathlib import Path

PAD, BOS, EOS, SEP, UNK = 0, 1, 2, 3, 4
SPECIALS = {"pad": PAD, "bos": BOS, "eos": EOS, "sep": SEP, "unk": UNK}


@dataclass
class Row:
    lemma: str
    tag: str
    form: str


def load_rows(path: Path, max_rows: int | None = None) -> list[Row]:
    rows: list[Row] = []
    with path.open(encoding="utf-8") as fh:
        for line in fh:
            parts = line.rstrip("\n").split("\t")
            if len(parts) != 3:
                continue
            rows.append(Row(*parts))
    if max_rows is not None and len(rows) > max_rows:
        rows = random.Random(42).sample(rows, max_rows)
    return rows


@dataclass
class Vocab:
    tokens: dict[str, int]

    @classmethod
    def build(cls, rows: list[Row]) -> "Vocab":
        tokens: dict[str, int] = {}
        next_id = len(SPECIALS)

        def add(token: str) -> None:
            nonlocal next_id
            if token not in tokens:
                tokens[token] = next_id
                next_id += 1

        for row in rows:
            for segment in row.tag.split(";"):
                add(segment)
        for row in rows:
            for ch in row.lemma + row.form:
                add(ch)
        return cls(tokens)

    @property
    def size(self) -> int:
        return len(SPECIALS) + len(self.tokens)

    def encode_src(self, lemma: str, tag: str) -> list[int]:
        ids = [self.tokens[s] for s in tag.split(";") if s in self.tokens]
        ids.append(SEP)
        ids.extend(self.tokens.get(ch, UNK) for ch in lemma)
        return ids

    def encode_tgt(self, form: str) -> list[int]:
        return [BOS] + [self.tokens.get(ch, UNK) for ch in form] + [EOS]

    def save(self, path: Path) -> None:
        payload = dict(SPECIALS)
        payload["tokens"] = self.tokens
        path.write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")

    @classmethod
    def load(cls, path: Path) -> "Vocab":
        payload = json.loads(path.read_text(encoding="utf-8"))
        return cls(payload["tokens"])


def hallucinate(rows: list[Row], vocab_chars: str, ratio: float, seed: int = 42) -> list[Row]:
    """SIGMORPHON-style data hallucination for OOV-stem robustness.

    For rows whose form contains the lemma as a prefix-stem (the common
    Hungarian case), replace that stem with a random character sequence in
    both lemma and form — teaching the model to *copy* unknown stems and
    transform only the ending.
    """
    rng = random.Random(seed)
    out: list[Row] = []
    for row in rows:
        if rng.random() > ratio:
            continue
        stem_len = _common_prefix(row.lemma, row.form)
        if stem_len < 3:
            continue
        fake = "".join(rng.choice(vocab_chars) for _ in range(rng.randint(3, 9)))
        out.append(
            Row(fake + row.lemma[stem_len:], row.tag, fake + row.form[stem_len:])
        )
    return out


def _common_prefix(a: str, b: str) -> int:
    n = 0
    for x, y in zip(a, b):
        if x != y:
            break
        n += 1
    return n
