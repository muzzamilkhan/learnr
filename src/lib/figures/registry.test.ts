import { describe, it, expect } from 'vitest';
import { FIGURE_KINDS } from './types';
import { figureKindModule } from './registry';

describe('the figure kind registry', () => {
  // Every kind the vocabulary names must be buildable. A kind added to
  // FIGURE_KINDS without a module would fall back to a triangle at runtime,
  // which is the silent failure this registry exists to make loud.
  it('has a module for every kind in the vocabulary', () => {
    for (const kind of FIGURE_KINDS) {
      expect(figureKindModule(kind), kind).toBeDefined();
      expect(figureKindModule(kind)!.kind).toBe(kind);
    }
  });

  it('has no module for a kind nobody declared', () => {
    expect(figureKindModule('trapezoidal-prism-net')).toBeUndefined();
  });
});
