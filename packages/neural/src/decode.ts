import type { InferenceSession, TensorLike } from "./engine.js";
import { encodeRequest, inverseVocab, type Vocab } from "./vocab.js";

/**
 * Batched greedy decoding over the two exported graphs:
 *
 * - `encoder`      : src [B,S] int64 → memory [B,S,D] float32
 * - `decoder_step` : memory, src, tgt [B,T] int64 → logits [B,T,V] float32
 *
 * The decoder is cache-less — it re-encodes the whole (short) target prefix
 * each step, which keeps the ONNX export trivial and is plenty fast for
 * word-length sequences.
 */

/** One decoding request. */
export interface DecodeRequest {
  lemma: string;
  tag: string;
}

interface Graphs {
  encoder: InferenceSession;
  decoderStep: InferenceSession;
}

function int64Tensor(rows: number[][], pad: number): TensorLike {
  const batch = rows.length;
  const width = Math.max(...rows.map((r) => r.length), 1);
  const data = new BigInt64Array(batch * width).fill(BigInt(pad));
  rows.forEach((row, b) => {
    row.forEach((id, i) => {
      data[b * width + i] = BigInt(id);
    });
  });
  return { type: "int64", data, dims: [batch, width] };
}

function argmaxLastStep(logits: TensorLike, batchIndex: number): number {
  const [batch, steps, vocabSize] = logits.dims as [number, number, number];
  if (batchIndex >= batch) throw new Error("neural decode: batch index out of range");
  const data = logits.data as Float32Array;
  const offset = (batchIndex * steps + (steps - 1)) * vocabSize;
  let best = 0;
  let bestScore = Number.NEGATIVE_INFINITY;
  for (let v = 0; v < vocabSize; v++) {
    const score = data[offset + v] as number;
    if (score > bestScore) {
      bestScore = score;
      best = v;
    }
  }
  return best;
}

/**
 * Greedily decode a batch of requests into inflected forms.
 *
 * @param maxExtra Decode at most `srcLength + maxExtra` characters — a
 * suffix can only add so much; runaway generations return `""`.
 */
export async function greedyDecodeBatch(
  graphs: Graphs,
  vocab: Vocab,
  requests: readonly DecodeRequest[],
  maxExtra = 12,
): Promise<string[]> {
  if (requests.length === 0) return [];
  const srcRows = requests.map((r) => encodeRequest(vocab, r.lemma, r.tag));
  const src = int64Tensor(srcRows, vocab.pad);

  const encoderOut = await graphs.encoder.run({ src });
  const memory = encoderOut[graphs.encoder.outputNames[0] as string] as TensorLike;

  const maxLen = Math.max(...srcRows.map((r) => r.length)) + maxExtra;
  const targets: number[][] = requests.map(() => [vocab.bos]);
  const done: boolean[] = requests.map(() => false);

  while (!done.every(Boolean) && (targets[0] as number[]).length <= maxLen) {
    const tgt = int64Tensor(targets, vocab.pad);
    const stepOut = await graphs.decoderStep.run({ memory, src, tgt });
    const logits = stepOut[graphs.decoderStep.outputNames[0] as string] as TensorLike;
    requests.forEach((_, b) => {
      const next = done[b] ? vocab.pad : argmaxLastStep(logits, b);
      if (next === vocab.eos) done[b] = true;
      (targets[b] as number[]).push(next);
    });
  }

  const inverse = inverseVocab(vocab);
  return targets.map((ids, b) => {
    if (!done[b]) return ""; // runaway generation: no answer
    let out = "";
    for (const id of ids) {
      if (id === vocab.bos || id === vocab.eos || id === vocab.pad) continue;
      out += inverse.get(id) ?? "";
    }
    return out;
  });
}
