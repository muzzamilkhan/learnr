import { describe, expect, it } from 'vitest';
import { allTemplates } from '../../src/content/catalog';
import type { QuestionTemplate } from '../../src/lib/templates/types';
import { expressionsOf, exprSet } from './expr';

const template = allTemplates.find((t) => t.id === 'maths.1.subtraction.difference')!;

/** The same angle, with its three parameters written in two different orders. */
const angle = (figure: QuestionTemplate['figure']): QuestionTemplate => ({
  id: 'maths.4.angles.made-up',
  subject: 'maths',
  topic: 'angles',
  level: '4',
  prompt: 'What kind of angle is this?',
  vars: [],
  answer: 'obtuse',
  figure,
});

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

  it("sorts a figure's parameters by name, whatever order the template wrote them", () => {
    // A figure's parameters reach here through `Object.entries`, so before they
    // were sorted the order was the author's keystroke order in a year file:
    // swapping two lines in `src/content/maths/2.ts` was a no-op for the engine
    // and moved that template's digest. Worse for the port it exists to verify -
    // a `Codable` FigureSpec has declared property order and `JSONSerialization`
    // has none, so insertion order is not something Swift can reproduce at all.
    const written = angle({ kind: 'angle', rotation: 'r', degrees: 'd', armLength: 'a' });
    const rewritten = angle({ kind: 'angle', armLength: 'a', degrees: 'd', rotation: 'r' });

    expect(expressionsOf(written)).toEqual(expressionsOf(rewritten));
    expect(expressionsOf(written)).toEqual(['obtuse', 'a', 'd', 'r']);
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
