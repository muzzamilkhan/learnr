import { describe, it, expect } from 'vitest';
import { MAX_PROMPT_CHARS, PROMPT_SENTINEL } from './limits';

describe('the prompt-length cap', () => {
  it('caps a prompt just above the longest one the content actually draws', () => {
    // The measured worst case is 135 characters
    // (`maths.5.chance.most-likely-from-trials`). The cap sits above it so a
    // number growing a digit inside an existing template is not a red suite.
    expect(MAX_PROMPT_CHARS).toBe(140);
  });
});

describe('the sentinel the prompt is sized against', () => {
  // The fitter searches for the largest size at which this string fits, and
  // applies that size to whatever the real prompt is. If it were shorter than
  // the cap, a real worst-case prompt would clip.
  it('is exactly as long as the cap', () => {
    expect(PROMPT_SENTINEL).toHaveLength(MAX_PROMPT_CHARS);
  });

  // A sentinel of `M`s measures a width no real prompt has and would shrink
  // every question to pay for it; a sentinel of `l`s or of one long word
  // measures too little and would clip. Ordinary words are what the content is
  // made of, so that is what the stand-in is made of.
  it('is ordinary prose rather than one repeated character', () => {
    const words = PROMPT_SENTINEL.split(' ');
    expect(words.length).toBeGreaterThan(15);
    for (const word of words) expect(word.length).toBeLessThanOrEqual(12);
    expect(new Set(PROMPT_SENTINEL).size).toBeGreaterThan(15);
  });

  it('contains digits, because every real prompt does', () => {
    expect(PROMPT_SENTINEL).toMatch(/\d\d/);
  });
});
