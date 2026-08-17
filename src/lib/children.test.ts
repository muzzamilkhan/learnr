import { describe, expect, it } from 'vitest';
import { resolveChild } from './children';

const profiles = [
  { id: 'a', name: 'Ada' },
  { id: 'b', name: 'Bo' },
];

describe('resolveChild', () => {
  it('picks the child the id names', () => {
    expect(resolveChild(profiles, 'b')?.name).toBe('Bo');
  });

  it('falls back to the first child when the id is unknown', () => {
    expect(resolveChild(profiles, 'nobody')?.name).toBe('Ada');
  });

  it('falls back to the first child when no id is given', () => {
    expect(resolveChild(profiles, null)?.name).toBe('Ada');
    expect(resolveChild(profiles, undefined)?.name).toBe('Ada');
  });

  it('has nothing to resolve without children', () => {
    expect(resolveChild([], 'a')).toBeNull();
  });
});
