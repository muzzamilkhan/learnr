import { describe, it, expect } from 'vitest';
import { evaluate } from '@/lib/expr';
import { wordFrom } from './helpers';

const RHYMES_AT = ['cat', 'hat', 'mat', 'bat'] as const;

describe('wordFrom', () => {
  it('gives back the word at each index of the bank', () => {
    for (let i = 0; i < RHYMES_AT.length; i++) {
      expect(evaluate(wordFrom(RHYMES_AT, String(i)), {})).toBe(RHYMES_AT[i]);
    }
  });

  it('reads an index that is itself an expression', () => {
    expect(evaluate(wordFrom(RHYMES_AT, '1 + 2'), {})).toBe('bat');
  });

  it('falls through to the last word for an index it was not told about', () => {
    // The chain ends in an unguarded else, exactly as `solidWord` and
    // `columnLetter` do. Documented rather than fixed: a guard would need a
    // failure value the expression language has no way to represent, and the
    // caller's `pick` list is what keeps the index in range.
    expect(evaluate(wordFrom(RHYMES_AT, '99'), {})).toBe('bat');
  });

  it('escapes nothing, because a bank is plain lowercase words', () => {
    expect(() => wordFrom(['a b'], '0')).toThrow();
  });
});
