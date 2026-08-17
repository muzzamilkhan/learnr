import { describe, expect, it } from 'vitest';
import { formatCount } from './format';

describe('formatCount', () => {
  it('leaves a small count alone', () => {
    expect(formatCount(0)).toBe('0');
    expect(formatCount(999)).toBe('999');
  });

  it('groups thousands', () => {
    expect(formatCount(1000)).toBe('1,000');
    expect(formatCount(12_345)).toBe('12,345');
  });
});
