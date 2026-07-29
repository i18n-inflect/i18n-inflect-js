/**
 * `@intl-inflect/neural` — the optional neural inflection fallback.
 *
 * Wires a tiny char-level seq2seq model (per-language package such as
 * `@intl-inflect/model-hu`) into intl-inflect's fallback slot, over a
 * swappable {@link InferenceEngine}:
 *
 * ```ts
 * import { registerFallback } from "intl-inflect";
 * import { createNeuralFallback } from "@intl-inflect/neural";
 * import { loadModelHu } from "@intl-inflect/model-hu";
 *
 * registerFallback(await createNeuralFallback({ model: await loadModelHu() }));
 * ```
 *
 * Engine resolution order when none is supplied: the Cordova native bridge
 * (`globalThis.boogieOnnx`) → onnxruntime-node (Node) → onnxruntime-web.
 *
 * @packageDocumentation
 */
import type { FallbackRequest, InflectionFallback } from "intl-inflect";
import { greedyDecodeBatch } from "./decode.js";
import type { InferenceEngine, InferenceSession, ModelSource } from "./engine.js";
import type { Vocab } from "./vocab.js";

export { type DecodeRequest, greedyDecodeBatch } from "./decode.js";
export type {
  InferenceEngine,
  InferenceSession,
  ModelSource,
  TensorData,
  TensorLike,
  TensorType,
} from "./engine.js";
export { decodeIds, encodeRequest, inverseVocab, type Vocab } from "./vocab.js";

/** A packaged model, as exported by `@intl-inflect/model-*` loaders. */
export interface NeuralModel {
  /** Primary language subtag the model serves ("hu"). */
  locale: string;
  encoder: ModelSource;
  decoderStep: ModelSource;
  vocab: Vocab;
  /** Decode budget beyond the source length (default 12). */
  maxDecodeExtra?: number;
}

/** Options for {@link createNeuralFallback}. */
export interface CreateNeuralFallbackOptions {
  model: NeuralModel;
  /** Inference backend; autodetected when omitted. */
  engine?: InferenceEngine;
}

interface HasBoogie {
  boogieOnnx?: unknown;
}

/** Detect the best backend for the current environment. */
export async function detectEngine(): Promise<InferenceEngine> {
  if ((globalThis as HasBoogie).boogieOnnx !== undefined) {
    const { boogieOnnxEngine } = await import("./engines/boogie-onnx.js");
    return boogieOnnxEngine();
  }
  if (typeof process !== "undefined" && process.versions?.node !== undefined) {
    const { ortNodeEngine } = await import("./engines/ort-node.js");
    return ortNodeEngine();
  }
  const { ortWebEngine } = await import("./engines/ort-web.js");
  return ortWebEngine();
}

/**
 * Create an {@link InflectionFallback} backed by a neural model.
 *
 * Sessions are created lazily on first use (or eagerly via `preload()`,
 * which `intl-inflect`'s `preload(locale)` calls). Errors during prediction
 * propagate to the engine, which degrades to the rule-based answer and
 * reports a `fallback-error` warning.
 */
export function createNeuralFallback(options: CreateNeuralFallbackOptions): InflectionFallback {
  const { model } = options;
  let sessions: Promise<{ encoder: InferenceSession; decoderStep: InferenceSession }> | undefined;

  const ensureSessions = (): NonNullable<typeof sessions> => {
    sessions ??= (async () => {
      const engine = options.engine ?? (await detectEngine());
      const [encoder, decoderStep] = await Promise.all([
        engine.createSession(model.encoder),
        engine.createSession(model.decoderStep),
      ]);
      return { encoder, decoderStep };
    })();
    return sessions;
  };

  return {
    locale: model.locale,
    async preload(): Promise<void> {
      await ensureSessions();
    },
    async predict(requests: readonly FallbackRequest[]): Promise<string[]> {
      const graphs = await ensureSessions();
      return greedyDecodeBatch(graphs, model.vocab, requests, model.maxDecodeExtra ?? 12);
    },
  };
}
