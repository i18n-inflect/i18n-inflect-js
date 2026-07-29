/**
 * The swappable inference-engine abstraction.
 *
 * Deliberately shaped as the minimal subset of the onnxruntime API that a
 * tiny seq2seq model needs, because every supported backend already speaks
 * it: `onnxruntime-web` (browser WASM), `onnxruntime-node` (native Node),
 * and the `cordova-plugin-boogie-onnx` native bridge (whose JS API mirrors
 * the same subset 1:1). Anything implementing these three interfaces can
 * run the models — the runtime is not married to ONNX.
 */

/** Supported tensor element types. */
export type TensorType = "float32" | "int64" | "int32" | "int8" | "uint8";

/** Typed arrays matching {@link TensorType}. */
export type TensorData = Float32Array | BigInt64Array | Int32Array | Int8Array | Uint8Array;

/** A plain tensor: the common denominator of every backend. */
export interface TensorLike {
  type: TensorType;
  data: TensorData;
  dims: number[];
}

/**
 * Where a model lives. Backends support different sources:
 * - `url` — browser fetch (onnxruntime-web)
 * - `path` — local file (onnxruntime-node, boogie-onnx: REQUIRED there,
 *   since the native side mmaps the file and bytes never cross the bridge)
 * - `bytes` — already-loaded model (onnxruntime-web/-node)
 */
export interface ModelSource {
  url?: string;
  path?: string;
  bytes?: Uint8Array;
}

/** A loaded model instance. */
export interface InferenceSession {
  readonly inputNames: readonly string[];
  readonly outputNames: readonly string[];
  run(feeds: Record<string, TensorLike>): Promise<Record<string, TensorLike>>;
  release(): Promise<void>;
}

/** A backend capable of loading models. */
export interface InferenceEngine {
  createSession(model: ModelSource): Promise<InferenceSession>;
}

/** Pick the first available source, throwing a helpful error otherwise. */
export function requireSource(
  model: ModelSource,
  supported: (keyof ModelSource)[],
): string | Uint8Array {
  for (const key of supported) {
    const value = model[key];
    if (value !== undefined) return value;
  }
  throw new Error(
    `intl-inflect/neural: model source must provide one of [${supported.join(", ")}]`,
  );
}
