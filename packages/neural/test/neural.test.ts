import { afterEach, describe, expect, it } from "vitest";
import type { TensorData, TensorLike } from "../src/engine.js";
import { boogieOnnxEngine } from "../src/engines/boogie-onnx.js";
import { createNeuralFallback, detectEngine, encodeRequest } from "../src/index.js";
import { mockEngine, testVocab } from "./mock-engine.js";

const vocab = testVocab();
const T = vocab.tokens;

describe("vocab encoding", () => {
  it("encodes tags, separator and lemma characters", () => {
    expect(encodeRequest(vocab, "ab", "N;ACC;SG")).toEqual([T.N, T.ACC, T.SG, vocab.sep, T.a, T.b]);
  });

  it("maps unknown characters to <unk> and skips unknown tags", () => {
    expect(encodeRequest(vocab, "a#", "N;BOGUS;SG")).toEqual([
      T.N,
      T.SG,
      vocab.sep,
      T.a,
      vocab.unk,
    ]);
  });
});

describe("createNeuralFallback with a mock engine", () => {
  it("decodes batches greedily and in order", async () => {
    const fallback = createNeuralFallback({
      model: {
        locale: "hu",
        encoder: { bytes: new Uint8Array() },
        decoderStep: { bytes: new Uint8Array() },
        vocab,
      },
      engine: mockEngine(vocab, T.t as number),
    });
    const result = await fallback.predict([
      { lemma: "alma", tag: "N;ACC;SG" },
      { lemma: "kefir", tag: "N;ACC;SG" },
    ]);
    // The fake model echoes the lemma and appends "t".
    expect(result).toEqual(["almat", "kefirt"]);
  });

  it("creates sessions lazily, once, and preload() warms them", async () => {
    const log = { createdSessions: [] as { bytes?: Uint8Array }[] };
    const fallback = createNeuralFallback({
      model: {
        locale: "hu",
        encoder: { bytes: new Uint8Array() },
        decoderStep: { bytes: new Uint8Array() },
        vocab,
      },
      engine: mockEngine(vocab, T.t as number, log),
    });
    expect(log.createdSessions).toHaveLength(0);
    await fallback.preload?.();
    expect(log.createdSessions).toHaveLength(2);
    await fallback.predict([{ lemma: "alma", tag: "N;ACC;SG" }]);
    expect(log.createdSessions).toHaveLength(2); // reused
  });
});

/** A minimal fake of the cordova-plugin-boogie-onnx global. */
function installBoogieMock(): {
  paths: string[];
  runs: Record<string, TensorLike>[];
} {
  const state = { paths: [] as string[], runs: [] as Record<string, TensorLike>[] };
  class Tensor {
    constructor(
      public type: string,
      public data: TensorData,
      public dims: number[],
    ) {}
  }
  (globalThis as { boogieOnnx?: unknown }).boogieOnnx = {
    Tensor,
    async createSession(path: string) {
      state.paths.push(path);
      return {
        inputNames: ["src"],
        outputNames: ["out"],
        async run(feeds: Record<string, TensorLike>) {
          state.runs.push(feeds);
          return { out: { type: "int64", data: feeds.src?.data, dims: feeds.src?.dims } };
        },
        async release() {},
      };
    },
  };
  return state;
}

describe("boogie-onnx engine adapter", () => {
  afterEach(() => {
    delete (globalThis as { boogieOnnx?: unknown }).boogieOnnx;
  });

  it("is selected by detectEngine when the global exists", async () => {
    installBoogieMock();
    const engine = await detectEngine();
    const session = await engine.createSession({ path: "file:///models/encoder.onnx" });
    expect(session.inputNames).toEqual(["src"]);
  });

  it("passes the model path and round-trips tensors", async () => {
    const state = installBoogieMock();
    const engine = boogieOnnxEngine({ device: "auto" });
    const session = await engine.createSession({ path: "file:///m.onnx" });
    const src: TensorLike = {
      type: "int64",
      data: new BigInt64Array([1n, 2n]),
      dims: [1, 2],
    };
    const out = await session.run({ src });
    expect(state.paths).toEqual(["file:///m.onnx"]);
    expect(out.out?.dims).toEqual([1, 2]);
    expect(out.out?.data).toEqual(new BigInt64Array([1n, 2n]));
  });

  it("demands a file path", async () => {
    installBoogieMock();
    const engine = boogieOnnxEngine();
    await expect(engine.createSession({ bytes: new Uint8Array() })).rejects.toThrow(
      /ModelSource\.path/,
    );
  });

  it("fails clearly without the plugin", async () => {
    const engine = boogieOnnxEngine();
    await expect(engine.createSession({ path: "x" })).rejects.toThrow(/boogieOnnx/);
  });
});

describe("integration with the i18n-inflect fallback slot", () => {
  it("plugs into registerFallback and upgrades async answers", async () => {
    const { registerLanguage, registerFallback, inflect, inflectAsync, clearOracle } = await import(
      "i18n-inflect"
    );
    clearOracle();
    registerLanguage({
      locale: "zz",
      inflectPhrase(phrase, _f, ctx) {
        const cached = ctx.lookup({ lemma: phrase, tag: "N;ACC;SG" });
        if (cached) return { text: cached, confidence: "high" };
        ctx.requestFallback({ lemma: phrase, tag: "N;ACC;SG" });
        return { text: phrase, confidence: "low" };
      },
    });
    registerFallback(
      createNeuralFallback({
        model: {
          locale: "zz",
          encoder: { bytes: new Uint8Array() },
          decoderStep: { bytes: new Uint8Array() },
          vocab,
        },
        engine: mockEngine(vocab, T.t as number),
      }),
    );
    expect(inflect("zz", "alma")).toBe("alma");
    await expect(inflectAsync("zz", "alma")).resolves.toBe("almat");
    expect(inflect("zz", "alma")).toBe("almat"); // oracle cache upgraded
  });
});
