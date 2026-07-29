"""Train the inflection model.

Usage (from the training/ directory):

    uv run train.py --lang hu                      # full training
    uv run train.py --lang hu --max-rows 50000 --epochs 3   # smoke run

Reads `../data/training/<lang>.{train,dev}.tsv` (emitted by the JS data
pipeline), writes `out/<lang>/model.pt` + `out/<lang>/vocab.json`.
"""

from __future__ import annotations

import argparse
import random
import time
from pathlib import Path

import torch
from torch import Tensor, nn
from torch.utils.data import DataLoader, Dataset

from data import BOS, EOS, PAD, Row, Vocab, hallucinate, load_rows
from model import InflectionModel

ROOT = Path(__file__).resolve().parent.parent


class InflectionDataset(Dataset):
    def __init__(self, rows: list[Row], vocab: Vocab) -> None:
        self.rows = rows
        self.vocab = vocab

    def __len__(self) -> int:
        return len(self.rows)

    def __getitem__(self, i: int) -> tuple[list[int], list[int]]:
        row = self.rows[i]
        return self.vocab.encode_src(row.lemma, row.tag), self.vocab.encode_tgt(row.form)


def collate(batch: list[tuple[list[int], list[int]]]) -> tuple[Tensor, Tensor]:
    src_w = max(len(s) for s, _ in batch)
    tgt_w = max(len(t) for _, t in batch)
    src = torch.full((len(batch), src_w), PAD, dtype=torch.long)
    tgt = torch.full((len(batch), tgt_w), PAD, dtype=torch.long)
    for i, (s, t) in enumerate(batch):
        src[i, : len(s)] = torch.tensor(s)
        tgt[i, : len(t)] = torch.tensor(t)
    return src, tgt


@torch.no_grad()
def greedy_exact_match(model: InflectionModel, rows: list[Row], vocab: Vocab, device: str, limit: int = 2000) -> float:
    sample = rows if len(rows) <= limit else random.Random(0).sample(rows, limit)
    inverse = {v: k for k, v in vocab.tokens.items()}
    correct = 0
    model.eval()
    for i in range(0, len(sample), 64):
        chunk = sample[i : i + 64]
        src_ids = [vocab.encode_src(r.lemma, r.tag) for r in chunk]
        width = max(len(s) for s in src_ids)
        src = torch.full((len(chunk), width), PAD, dtype=torch.long, device=device)
        for j, s in enumerate(src_ids):
            src[j, : len(s)] = torch.tensor(s, device=device)
        memory = model.encode(src)
        tgt = torch.full((len(chunk), 1), BOS, dtype=torch.long, device=device)
        done = torch.zeros(len(chunk), dtype=torch.bool, device=device)
        for _ in range(width + 12):
            logits = model.decode_step(memory, src, tgt)
            next_ids = logits[:, -1].argmax(-1)
            next_ids = torch.where(done, torch.full_like(next_ids, PAD), next_ids)
            done |= next_ids.eq(EOS)
            tgt = torch.cat([tgt, next_ids.unsqueeze(1)], dim=1)
            if bool(done.all()):
                break
        for j, row in enumerate(chunk):
            ids = [int(x) for x in tgt[j, 1:].tolist()]
            text = "".join(inverse.get(t, "") for t in ids if t not in (PAD, EOS, BOS))
            # Stop at the first EOS position implicitly handled by PAD fill.
            if text == row.form:
                correct += 1
    return correct / len(sample)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--lang", default="hu")
    ap.add_argument("--epochs", type=int, default=12)
    ap.add_argument("--batch-size", type=int, default=512)
    ap.add_argument("--lr", type=float, default=5e-4)
    ap.add_argument("--max-rows", type=int, default=None)
    ap.add_argument("--hallucinate", type=float, default=0.3, help="augmentation ratio (0 disables)")
    ap.add_argument("--seed", type=int, default=42)
    args = ap.parse_args()

    torch.manual_seed(args.seed)
    random.seed(args.seed)
    device = "cuda" if torch.cuda.is_available() else "mps" if torch.backends.mps.is_available() else "cpu"

    train_rows = load_rows(ROOT / "data" / "training" / f"{args.lang}.train.tsv", args.max_rows)
    dev_rows = load_rows(ROOT / "data" / "training" / f"{args.lang}.dev.tsv")
    vocab = Vocab.build(train_rows)
    chars = "".join(t for t in vocab.tokens if len(t) == 1)
    if args.hallucinate > 0:
        extra = hallucinate(train_rows, chars, args.hallucinate, args.seed)
        print(f"hallucinated {len(extra)} synthetic rows")
        train_rows = train_rows + extra

    print(f"device={device} train={len(train_rows)} dev={len(dev_rows)} vocab={vocab.size}")
    model = InflectionModel(vocab.size).to(device)
    print(f"parameters: {sum(p.numel() for p in model.parameters()):,}")

    loader = DataLoader(
        InflectionDataset(train_rows, vocab),
        batch_size=args.batch_size,
        shuffle=True,
        collate_fn=collate,
    )
    optimizer = torch.optim.AdamW(model.parameters(), lr=args.lr)
    scheduler = torch.optim.lr_scheduler.CosineAnnealingLR(optimizer, T_max=args.epochs * len(loader))
    criterion = nn.CrossEntropyLoss(ignore_index=PAD, label_smoothing=0.1)

    out_dir = Path(__file__).resolve().parent / "out" / args.lang
    out_dir.mkdir(parents=True, exist_ok=True)
    vocab.save(out_dir / "vocab.json")

    best = 0.0
    for epoch in range(1, args.epochs + 1):
        model.train()
        started = time.time()
        total = 0.0
        for src, tgt in loader:
            src, tgt = src.to(device), tgt.to(device)
            logits = model(src, tgt[:, :-1])
            loss = criterion(logits.reshape(-1, logits.size(-1)), tgt[:, 1:].reshape(-1))
            optimizer.zero_grad()
            loss.backward()
            torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
            optimizer.step()
            scheduler.step()
            total += float(loss.detach())
        accuracy = greedy_exact_match(model, dev_rows, vocab, device) if dev_rows else 0.0
        print(
            f"epoch {epoch}: loss {total / len(loader):.4f}, dev exact-match {accuracy:.2%}, "
            f"{time.time() - started:.0f}s"
        )
        if accuracy >= best:
            best = accuracy
            torch.save(model.state_dict(), out_dir / "model.pt")
    print(f"best dev exact-match: {best:.2%} → {out_dir / 'model.pt'}")


if __name__ == "__main__":
    main()
