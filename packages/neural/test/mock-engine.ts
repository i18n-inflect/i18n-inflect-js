import type { InferenceEngine, InferenceSession, ModelSource, TensorLike } from "../src/engine.js";
import type { Vocab } from "../src/vocab.js";

/**
 * A deterministic fake backend for tests: the "model" it simulates echoes
 * the lemma (the src tokens after `<sep>`) and appends one extra token — the
 * id stored in `suffixId` — before EOS. This exercises the whole
 * encode → encoder → step-loop → argmax → decode pipeline without ONNX.
 */

export function testVocab(): Vocab {
  const tokens: Record<string, number> = {};
  let next = 5;
  for (const tag of ["N", "ACC", "INS", "SG", "PL"]) tokens[tag] = next++;
  for (const ch of "abcdefghijklmnopqrstuvwxyzáéíóöőúüű") tokens[ch] = next++;
  return { pad: 0, bos: 1, eos: 2, sep: 3, unk: 4, tokens };
}

/** Read a [B,S] int64 tensor back into number rows (dropping padding). */
function rowsOf(t: TensorLike): number[][] {
  const [batch, width] = t.dims as [number, number];
  const data = t.data as BigInt64Array;
  const rows: number[][] = [];
  for (let b = 0; b < batch; b++) {
    const row: number[] = [];
    for (let i = 0; i < width; i++) row.push(Number(data[b * width + i]));
    rows.push(row);
  }
  return rows;
}

export interface MockEngineLog {
  createdSessions: ModelSource[];
}

/**
 * Build the fake engine. `suffixId(lemmaIds)` decides the appended token.
 */
export function mockEngine(
  vocab: Vocab,
  suffixId: number,
  log: MockEngineLog = { createdSessions: [] },
): InferenceEngine {
  const vocabSize = Math.max(...Object.values(vocab.tokens)) + 1;

  const encoder: InferenceSession = {
    inputNames: ["src"],
    outputNames: ["memory"],
    async run(feeds) {
      const src = feeds.src as TensorLike;
      const [batch, width] = src.dims as [number, number];
      // Memory simply carries the src ids as floats — enough for the fake.
      const data = new Float32Array(batch * width);
      (src.data as BigInt64Array).forEach((v, i) => {
        data[i] = Number(v);
      });
      return { memory: { type: "float32", data, dims: [batch, width, 1] } };
    },
    release: async () => {},
  };

  const decoderStep: InferenceSession = {
    inputNames: ["memory", "src", "tgt"],
    outputNames: ["logits"],
    async run(feeds) {
      const src = rowsOf(feeds.src as TensorLike);
      const tgt = rowsOf(feeds.tgt as TensorLike);
      const batch = src.length;
      const steps = (tgt[0] as number[]).length;
      const logits = new Float32Array(batch * steps * vocabSize).fill(-1e9);
      for (let b = 0; b < batch; b++) {
        const sepAt = (src[b] as number[]).indexOf(vocab.sep);
        const lemmaIds = (src[b] as number[]).slice(sepAt + 1).filter((id) => id !== vocab.pad);
        const answer = [...lemmaIds, suffixId];
        // Only the LAST step's distribution matters to greedy decoding.
        const generated = steps - 1; // tokens after BOS
        const desired = generated < answer.length ? (answer[generated] as number) : vocab.eos;
        logits[(b * steps + (steps - 1)) * vocabSize + desired] = 1;
      }
      return { logits: { type: "float32", data: logits, dims: [batch, steps, vocabSize] } };
    },
    release: async () => {},
  };

  return {
    async createSession(model) {
      log.createdSessions.push(model);
      // First created session acts as the encoder, second as the decoder.
      return log.createdSessions.length % 2 === 1 ? encoder : decoderStep;
    },
  };
}
