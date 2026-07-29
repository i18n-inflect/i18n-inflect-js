import type { NeuralModel, Vocab } from "@intl-inflect/neural";

/**
 * Loader for the Hungarian neural inflection model.
 *
 * The model ships as three assets next to this module:
 * `assets/encoder.onnx`, `assets/decoder_step.onnx`, `assets/vocab.json`
 * (built by the `models.yml` workflow from `training/`; weights are
 * CC BY-SA 3.0 as UniMorph derivatives).
 *
 * Environments resolve assets differently:
 * - **Node**: file paths derived from `import.meta.url` (default).
 * - **Browser/bundlers**: pass `baseUrl` pointing at the served assets, or
 *   let the default `new URL(..., import.meta.url)` work through your
 *   bundler's asset handling.
 * - **Cordova (boogie-onnx)**: pass `paths` with on-device file paths —
 *   the native bridge loads models by path only.
 */
export interface LoadModelHuOptions {
  /** Directory URL containing the three assets (with trailing slash). */
  baseUrl?: string;
  /** Explicit file paths (Node or Cordova native engine). */
  paths?: {
    encoder: string;
    decoderStep: string;
    vocab: string;
  };
}

const ASSET_NAMES = {
  encoder: "encoder.onnx",
  decoderStep: "decoder_step.onnx",
  vocab: "vocab.json",
} as const;

async function readVocab(source: { url?: string; path?: string }): Promise<Vocab> {
  if (source.path !== undefined) {
    const { readFile } = await import("node:fs/promises");
    return JSON.parse(await readFile(source.path, "utf8")) as Vocab;
  }
  if (source.url !== undefined) {
    const response = await fetch(source.url);
    if (!response.ok) {
      throw new Error(
        `@intl-inflect/model-hu: cannot load ${source.url} (${response.status}) — are the model assets present? They are built by the models workflow, not stored in git.`,
      );
    }
    return (await response.json()) as Vocab;
  }
  throw new Error("@intl-inflect/model-hu: no vocab source");
}

/** Load the Hungarian model descriptor for `createNeuralFallback`. */
export async function loadModelHu(options: LoadModelHuOptions = {}): Promise<NeuralModel> {
  if (options.paths) {
    return {
      locale: "hu",
      encoder: { path: options.paths.encoder },
      decoderStep: { path: options.paths.decoderStep },
      vocab: await readVocab({ path: options.paths.vocab }),
    };
  }

  const base = options.baseUrl ?? new URL("../assets/", import.meta.url).href;
  const urlOf = (name: string): string => new URL(name, base).href;

  if (base.startsWith("file:")) {
    const { fileURLToPath } = await import("node:url");
    const pathOf = (name: string): string => fileURLToPath(urlOf(name));
    return {
      locale: "hu",
      encoder: { path: pathOf(ASSET_NAMES.encoder) },
      decoderStep: { path: pathOf(ASSET_NAMES.decoderStep) },
      vocab: await readVocab({ path: pathOf(ASSET_NAMES.vocab) }),
    };
  }

  return {
    locale: "hu",
    encoder: { url: urlOf(ASSET_NAMES.encoder) },
    decoderStep: { url: urlOf(ASSET_NAMES.decoderStep) },
    vocab: await readVocab({ url: urlOf(ASSET_NAMES.vocab) }),
  };
}
