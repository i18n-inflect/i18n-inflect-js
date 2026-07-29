import type { InferenceEngine, TensorData, TensorLike, TensorType } from "../engine.js";
import { requireSource } from "../engine.js";

/**
 * onnxruntime-node adapter (native CPU execution in Node.js).
 *
 * `onnxruntime-node` is an optional peer dependency, imported lazily.
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
export interface OrtNodeEngineOptions {
  sessionOptions?: Record<string, unknown>;
}

/** Create the onnxruntime-node backend. */
export function ortNodeEngine(options: OrtNodeEngineOptions = {}): InferenceEngine {
  return {
    async createSession(model) {
      const ort = (await import("onnxruntime-node")) as unknown as OrtModule;
      const source = requireSource(model, ["path", "bytes"]);
      const session = await ort.InferenceSession.create(source, options.sessionOptions);
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
    },
  };
}
