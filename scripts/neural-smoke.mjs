/**
 * End-to-end JS smoke test of the neural runtime against REAL trained ONNX
 * artifacts (training/out/hu). Verifies the whole contract: vocab encoding,
 * batched greedy decode, the ort-node engine adapter, and integration with
 * the intl-inflect fallback slot.
 *
 * Prints predictions vs. UniMorph gold — accuracy depends on how long the
 * model was trained; the CONTRACT (loadable, decodable, sane strings) is
 * what this script gates on.
 *
 * Usage: node scripts/neural-smoke.mjs   (after training/export/quantize)
 */
import { readFileSync } from "node:fs";
import { ortNodeEngine } from "../packages/neural/dist/engines/ort-node.js";
import { createNeuralFallback } from "../packages/neural/dist/index.js";

const out = new URL("../training/out/hu/", import.meta.url);
const vocab = JSON.parse(readFileSync(new URL("vocab.json", out), "utf8"));

const fallback = createNeuralFallback({
  model: {
    locale: "hu",
    encoder: { path: new URL("encoder_int8.onnx", out).pathname },
    decoderStep: { path: new URL("decoder_step_int8.onnx", out).pathname },
    vocab,
  },
  engine: ortNodeEngine(),
});

const cases = [
  { lemma: "ház", tag: "N;INS;SG", gold: "házzal" },
  { lemma: "alma", tag: "N;ACC;SG", gold: "almát" },
  { lemma: "kert", tag: "N;IN+ESS;SG", gold: "kertben" },
  { lemma: "busz", tag: "N;INS;SG", gold: "busszal" },
  { lemma: "tükör", tag: "N;ACC;SG", gold: "tükröt" },
  { lemma: "víz", tag: "N;NOM;PL", gold: "vizek" },
];

await fallback.preload();
const started = performance.now();
const predictions = await fallback.predict(cases);
const elapsed = performance.now() - started;

let sane = 0;
cases.forEach((c, i) => {
  const p = predictions[i];
  const ok = p === c.gold;
  // "Sane" = non-empty and echoes at least the first two lemma characters.
  if (p.length > 0 && p.startsWith(c.lemma.slice(0, 2))) sane++;
  console.log(`${ok ? "✔" : "·"} ${c.lemma} + ${c.tag} → ${p || "(empty)"} (gold: ${c.gold})`);
});
console.log(`batch of ${cases.length} decoded in ${elapsed.toFixed(0)} ms`);

if (sane < cases.length / 2) {
  console.error("FAIL: fewer than half of the predictions are sane copies — contract broken?");
  process.exit(1);
}
console.log("neural runtime contract OK ✔");
