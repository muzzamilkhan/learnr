import { describe, it, expect } from 'vitest';
import { evaluate, compile } from './index';

const ev = (src: string, scope: Record<string, unknown> = {}) => evaluate(src, scope);

describe('arithmetic', () => {
  it('evaluates literals and basic operators', () => {
    expect(ev('1 + 2')).toBe(3);
    expect(ev('7 - 2 * 3')).toBe(1);
    expect(ev('(7 - 2) * 3')).toBe(15);
    expect(ev('7 / 2')).toBe(3.5);
    expect(ev('7 % 3')).toBe(1);
    expect(ev('2 ^ 3 ^ 2')).toBe(512); // right associative
    expect(ev('-4 + 1')).toBe(-3);
    expect(ev('1.5 * 2')).toBe(3);
  });

  it('resolves variables from scope', () => {
    expect(ev('x - y', { x: 9, y: 4 })).toBe(5);
    expect(ev('x * x', { x: 6 })).toBe(36);
  });

  it('throws on unknown identifiers', () => {
    expect(() => ev('x + z', { x: 1 })).toThrow(/unknown variable: z/i);
  });
});

describe('comparison and logic', () => {
  it('compares numbers', () => {
    expect(ev('x > y', { x: 9, y: 4 })).toBe(true);
    expect(ev('x >= y', { x: 4, y: 4 })).toBe(true);
    expect(ev('x != y', { x: 4, y: 4 })).toBe(false);
    expect(ev('x == y', { x: 4, y: 4 })).toBe(true);
  });

  it('combines with and/or/not', () => {
    expect(ev('x > 2 && x < 10', { x: 5 })).toBe(true);
    expect(ev('x < 2 || x > 10', { x: 5 })).toBe(false);
    expect(ev('!(x == 3)', { x: 5 })).toBe(true);
  });

  it('supports ternary', () => {
    expect(ev('x > y ? x : y', { x: 3, y: 8 })).toBe(8);
  });
});

describe('functions', () => {
  it('supports the maths helpers templates need', () => {
    expect(ev('abs(0 - 5)')).toBe(5);
    expect(ev('min(3, 9, 4)')).toBe(3);
    expect(ev('max(3, 9, 4)')).toBe(9);
    expect(ev('floor(7 / 2)')).toBe(3);
    expect(ev('ceil(7 / 2)')).toBe(4);
    expect(ev('round(2.5)')).toBe(3);
    expect(ev('gcd(12, 18)')).toBe(6);
    expect(ev('lcm(4, 6)')).toBe(12);
    expect(ev('sqrt(81)')).toBe(9);
    expect(ev('isInt(4.0)')).toBe(true);
    expect(ev('isInt(4.5)')).toBe(false);
  });

  it('throws on unknown functions', () => {
    expect(() => ev('frobnicate(2)')).toThrow(/unknown function/i);
  });
});

describe('strings', () => {
  it('handles string literals and equality', () => {
    expect(ev("op == '+'", { op: '+' })).toBe(true);
    expect(ev('"a" == "b"')).toBe(false);
  });

  it('concatenates strings with +', () => {
    expect(ev("a + 'x'", { a: 'b' })).toBe('bx');
  });
});

describe('safety', () => {
  it('refuses to reach global scope', () => {
    expect(() => ev('constructor')).toThrow(/unknown variable/i);
    expect(() => ev('process')).toThrow(/unknown variable/i);
    expect(() => ev('__proto__')).toThrow(/unknown variable/i);
  });

  it('rejects malformed input rather than guessing', () => {
    expect(() => ev('1 +')).toThrow();
    expect(() => ev('(1 + 2')).toThrow();
    expect(() => ev('1 2')).toThrow();
    expect(() => ev('')).toThrow();
    expect(() => ev('1 = 2')).toThrow();
  });
});

describe('compile', () => {
  it('parses once and reuses the AST', () => {
    const fn = compile('x + y');
    expect(fn({ x: 1, y: 2 })).toBe(3);
    expect(fn({ x: 10, y: 20 })).toBe(30);
  });

  it('reports the source in parse errors', () => {
    expect(() => compile('x +* y')).toThrow(/x \+\* y/);
  });
});
