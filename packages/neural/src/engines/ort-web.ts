import type {
  InferenceEngine,
  InferenceSession,
  TensorData,
  TensorLike,
  TensorType,
} from "../engine.js";
import { requireSource } from "../engine.js";

/**
 * onnxruntime-web adapter (browser, WASM execution provider).
 *
 * `onnxruntime-web` is an optional peer dependency, imported lazily so
 * that bundles not using this engine never include it.
 */

interface OrtModule {
  InferenceSession: {
    create(source: string | Uint8Array, options?: unknown): Promise<OrtSession>;
  };
  Tensor: new (type: string, data: TensorData, dims: number[]) => unknown;
}

interface OrtTensor {
  type: string;
  data: TensorData;
  dims: readonly number[];
}

interface OrtSession {
  inputNames: readonly string[];
  outputNames: readonly string[];
  run(feeds: Record<string, unknown>): Promise<Record<string, OrtTensor>>;
  release(): Promise<void>;
}

/** Session options forwarded to `ort.InferenceSession.create`. */
export interface OrtWebEngineOptions {
  sessionOptions?: Record<string, unknown>;
}

function wrapSession(ort: OrtModule, session: OrtSession): InferenceSession {
  return {
    inputNames: session.inputNames,
    outputNames: session.outputNames,
    async run(feeds: Record<string, TensorLike>): Promise<Record<string, TensorLike>> {
      const ortFeeds: Record<string, unknown> = {};
      for (const [name, t] of Object.entries(feeds)) {
        ortFeeds[name] = new ort.Tensor(t.type, t.data, t.dims);
      }
      const outputs = await session.run(ortFeeds);
      const result: Record<string, TensorLike> = {};
      for (const [name, t] of Object.entries(outputs)) {
        result[name] = { type: t.type as TensorType, data: t.data, dims: [...t.dims] };
      }
      return result;
    },
    release: () => session.release(),
  };
}

/** Create the onnxruntime-web backend. */
export function ortWebEngine(options: OrtWebEngineOptions = {}): InferenceEngine {
  return {
    async createSession(model) {
      const ort = (await import("onnxruntime-web")) as unknown as OrtModule;
      const source = requireSource(model, ["bytes", "url"]);
      const session = await ort.InferenceSession.create(source, options.sessionOptions);
      return wrapSession(ort, session);
    },
  };
}
