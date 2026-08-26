import { describe, expect, it } from 'vitest';
import { allTemplates } from '../../src/content/catalog';
import { expressionsOf, exprSet } from './expr';

const template = allTemplates.find((t) => t.id === 'maths.1.subtraction.difference')!;

describe('expressionsOf', () => {
  it('takes the answer, the constraints, the bounds and the prompt holes', () => {
    const found = expressionsOf(template);
    expect(found).toContain('x - y');
    expect(found).toContain('x > y');
    expect(found).toContain('x');
    expect(found).toContain('y');
  });

  it('is deduplicated and stable', () => {
    expect(expressionsOf(template)).toEqual(expressionsOf(template));
    expect(new Set(expressionsOf(template)).size).toBe(expressionsOf(template).length);
  });

  it('finds every distinct expression the shipped content holds', () => {
    const all = new Set(allTemplates.flatMap(expressionsOf));
    // 1,453 today (docs and CLAUDE.md's "golden corpus" section cite the same
    // figure). >700 would pass a harvester that lost half its coverage.
    expect(all.size).toBeGreaterThan(1400);
  });
});

describe('exprSet', () => {
  it('groups the traps under their own name, beside a group per template', () => {
    const set = exprSet(allTemplates);
    expect(set.name).toBe('expr');
    expect(set.groups.has('traps')).toBe(true);
    expect(set.groups.has(template.id)).toBe(true);
    for (const hash of set.groups.values()) expect(hash).toMatch(/^[0-9a-f]{12}$/);
  });

  it('is deterministic', () => {
    expect([...exprSet(allTemplates).groups]).toEqual([...exprSet(allTemplates).groups]);
  });
});
