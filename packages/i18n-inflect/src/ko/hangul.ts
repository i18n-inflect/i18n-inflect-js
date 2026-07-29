/**
 * Hangul syllable analysis for particle selection.
 *
 * A precomposed syllable (U+AC00–U+D7A3) encodes its final consonant
 * (batchim) as `(codepoint - 0xAC00) % 28`: 0 = open syllable, 8 = ㄹ
 * (which selects 로 instead of 으로 for the instrumental).
 */

/** What particle alternation the phrase-final character calls for. */
export interface FinalSound {
  /** True when the syllable ends in a consonant (batchim). */
  hasBatchim: boolean;
  /** True when that consonant is ㄹ (jongseong index 8). */
  isRieul: boolean;
}

const HANGUL_BASE = 0xac00;
const HANGUL_END = 0xd7a3;

/**
 * Korean readings of digits (native Sino-Korean): 0 영, 1 일, 2 이, 3 삼,
 * 4 사, 5 오, 6 육, 7 칠, 8 팔, 9 구 — encoded as their final-sound classes.
 */
const DIGIT_FINALS: Record<string, FinalSound> = {
  "0": { hasBatchim: true, isRieul: false }, // 영
  "1": { hasBatchim: true, isRieul: true }, // 일
  "2": { hasBatchim: false, isRieul: false }, // 이
  "3": { hasBatchim: true, isRieul: false }, // 삼
  "4": { hasBatchim: false, isRieul: false }, // 사
  "5": { hasBatchim: false, isRieul: false }, // 오
  "6": { hasBatchim: true, isRieul: false }, // 육
  "7": { hasBatchim: true, isRieul: true }, // 칠
  "8": { hasBatchim: true, isRieul: true }, // 팔
  "9": { hasBatchim: false, isRieul: false }, // 구
};

/**
 * Analyze the last pronounceable character of a phrase.
 *
 * Returns `undefined` when the final sound cannot be determined (Latin
 * script, symbols) — callers then use the paired particle form ("을(를)").
 */
export function finalSoundOf(phrase: string): FinalSound | undefined {
  for (let i = phrase.length - 1; i >= 0; i--) {
    const ch = phrase[i] as string;
    if (/[\s.,;:!?…"'()[\]{}]/.test(ch)) continue;
    const cp = ch.codePointAt(0) as number;
    if (cp >= HANGUL_BASE && cp <= HANGUL_END) {
      const jong = (cp - HANGUL_BASE) % 28;
      return { hasBatchim: jong > 0, isRieul: jong === 8 };
    }
    const digit = DIGIT_FINALS[ch];
    if (digit) return digit;
    return undefined; // undecidable script
  }
  return undefined;
}
