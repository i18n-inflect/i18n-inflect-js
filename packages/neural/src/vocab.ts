/**
 * Vocabulary handling for the character-level seq2seq models.
 *
 * The vocab file is emitted by `training/export_onnx.py` and shared
 * verbatim between training and this runtime — ids must match exactly.
 */

/** Parsed contents of a model's `vocab.json`. */
export interface Vocab {
  /** Special token ids. */
  pad: number;
  bos: number;
  eos: number;
  sep: number;
  unk: number;
  /** Token → id for characters AND morphological tag tokens ("ACC", "PL"…). */
  tokens: Record<string, number>;
}

/** Reverse index: id → token (built once per vocab). */
export function inverseVocab(vocab: Vocab): Map<number, string> {
  const inverse = new Map<number, string>();
  for (const [token, id] of Object.entries(vocab.tokens)) inverse.set(id, token);
  return inverse;
}

/**
 * Encode one request as model input ids:
 * `TAG₁ TAG₂ … <sep> l e m m a` — tags are the `;`-split segments of the
 * UniMorph bundle, characters follow the separator.
 */
export function encodeRequest(vocab: Vocab, lemma: string, tag: string): number[] {
  const ids: number[] = [];
  for (const segment of tag.split(";")) {
    const id = vocab.tokens[segment];
    if (id !== undefined) ids.push(id);
  }
  ids.push(vocab.sep);
  for (const ch of lemma) {
    ids.push(vocab.tokens[ch] ?? vocab.unk);
  }
  return ids;
}

/** Decode output ids (already stripped of specials) into a string. */
export function decodeIds(vocab: Vocab, ids: readonly number[]): string {
  const inverse = inverseVocab(vocab);
  let out = "";
  for (const id of ids) {
    const token = inverse.get(id);
    if (token !== undefined) out += token;
  }
  return out;
}
