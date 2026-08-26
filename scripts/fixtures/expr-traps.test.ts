import { describe, expect, it } from 'vitest';
import { evaluate, FUNCTIONS } from '../../src/lib/expr';
import { EXPR_TRAPS } from './expr-traps';

describe('the expression traps', () => {
  it.each(EXPR_TRAPS)('$expr', ({ expr, scope, expect: expected }) => {
    expect(evaluate(expr, scope ?? {})).toBe(expected);
  });

  it('names every function the language has, so a new one cannot arrive untested', () => {
    const covered = new Set(
      EXPR_TRAPS.flatMap(({ expr }) => [...expr.matchAll(/([a-zA-Z]\w*)\s*\(/g)].map((m) => m[1])),
    );
    expect(Object.keys(FUNCTIONS).filter((name) => !covered.has(name))).toEqual([]);
  });

  it('has no duplicate cases', () => {
    const keys = EXPR_TRAPS.map(({ expr, scope }) => `${expr}|${JSON.stringify(scope ?? {})}`);
    expect(new Set(keys).size).toBe(keys.length);
  });
});
