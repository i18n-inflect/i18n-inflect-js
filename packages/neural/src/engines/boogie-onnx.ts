import type { InferenceEngine, InferenceSession, TensorData, TensorLike } from "../engine.js";

/**
 * Adapter for the `cordova-plugin-boogie-onnx` native bridge — zero
 * dependencies: it talks to the global `boogieOnnx` object the Cordova
 * plugin installs. The plugin runs models with the platform-native ONNX
 * Runtime (NNAPI/XNNPACK on Android, CoreML on iOS) instead of WASM in the
 * WebView — correct numerics and much better speed.
 *
 * The plugin's JS API deliberately mirrors the onnxruntime subset this
 * package needs, so the adapter is a thin pass-through. One constraint:
 * the native side loads models from a **file path** (`ModelSource.path`) —
 * bytes never cross the Cordova bridge.
 */

interface BoogieTensor {
  type: string;
  data: TensorData;
  dims: number[];
}

interface BoogieSession {
  inputNames: string[];
  outputNames: string[];
  run(feeds: Record<string, BoogieTensor>): Promise<Record<string, BoogieTensor>>;
  release(): Promise<void>;
}

interface BoogieOnnx {
  createSession(modelPath: string, options?: Record<string, unknown>): Promise<BoogieSession>;
  Tensor: new (type: string, data: TensorData, dims: number[]) => BoogieTensor;
}

/** Options forwarded to `boogieOnnx.createSession`. */
export interface BoogieOnnxEngineOptions {
  /** Execution provider hint: 'cpu' (default) | 'auto' | 'nnapi' | 'xnnpack' | 'coreml'. */
  device?: string;
  /** Any further `createSession` options the plugin understands. */
  sessionOptions?: Record<string, unknown>;
}

function bridge(): BoogieOnnx {
  const b = (globalThis as { boogieOnnx?: BoogieOnnx }).boogieOnnx;
  if (b === undefined) {
    throw new Error(
      "i18n-inflect/neural: global `boogieOnnx` not found — is cordova-plugin-boogie-onnx installed and the deviceready event fired?",
    );
  }
  return b;
}

/** Create the Cordova native-bridge backend. */
export function boogieOnnxEngine(options: BoogieOnnxEngineOptions = {}): InferenceEngine {
  return {
    async createSession(model) {
      if (model.path === undefined) {
        throw new Error(
          "i18n-inflect/neural: the boogie-onnx engine needs ModelSource.path — the native side loads the model file directly (bytes never cross the Cordova bridge)",
        );
      }
      const b = bridge();
      const session = await b.createSession(model.path, {
        device: options.device ?? "cpu",
        ...options.sessionOptions,
      });
      return wrap(b, session);
    },
  };
}

function wrap(b: BoogieOnnx, session: BoogieSession): InferenceSession {
  return {
    inputNames: session.inputNames,
    outputNames: session.outputNames,
    async run(feeds: Record<string, TensorLike>): Promise<Record<string, TensorLike>> {
      const nativeFeeds: Record<string, BoogieTensor> = {};
      for (const [name, t] of Object.entries(feeds)) {
        nativeFeeds[name] = new b.Tensor(t.type, t.data, t.dims);
      }
      const outputs = await session.run(nativeFeeds);
      const result: Record<string, TensorLike> = {};
      for (const [name, t] of Object.entries(outputs)) {
        result[name] = {
          type: t.type as TensorLike["type"],
          data: t.data,
          dims: [...t.dims],
        };
      }
      return result;
    },
    release: () => session.release(),
  };
}
