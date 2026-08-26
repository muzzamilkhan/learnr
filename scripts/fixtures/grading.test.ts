import { describe, expect, it } from 'vitest';
import { allTemplates } from '../../src/content/catalog';
import { createRng } from '../../src/lib/rng';
import { generateQuestion } from '../../src/lib/templates/generate';
import { gradingSet, responsesFor } from './grading';

const questionFor = (id: string) =>
  generateQuestion(allTemplates.find((t) => t.id === id)!, createRng(`${id}:0`));

describe('responsesFor', () => {
  it('offers the answer, the answer padded, and junk', () => {
    const q = questionFor('maths.1.subtraction.difference');
    const responses = responsesFor(q);
    expect(responses).toContain(String(q.answer));
    expect(responses).toContain(` ${String(q.answer)} `);
    expect(responses).toContain('');
    expect(responses).toContain('abc');
  });

  it('straddles the tolerance for a numeric answer', () => {
    const q = questionFor('maths.1.subtraction.difference');
    const responses = responsesFor(q);
    expect(responses).toContain(String(Number(q.answer) + 1e-10));
    expect(responses).toContain(String(Number(q.answer) + 1e-8));
  });

  it('offers all eight boolean spellings for a true/false question', () => {
    const template = allTemplates.find(
      (t) => generateQuestion(t, createRng(`${t.id}:0`)).answerType === 'boolean',
    )!;
    const responses = responsesFor(generateQuestion(template, createRng(`${template.id}:0`)));
    for (const said of ['true', 'yes', 't', 'y', 'false', 'no', 'f', 'n']) {
      expect(responses).toContain(said);
    }
  });

  it('is deduplicated', () => {
    const responses = responsesFor(questionFor('maths.1.subtraction.difference'));
    expect(new Set(responses).size).toBe(responses.length);
  });
});

describe('gradingSet', () => {
  it('groups by template and hashes', () => {
    const set = gradingSet(allTemplates);
    expect(set.name).toBe('grading');
    expect(set.groups.size).toBe(allTemplates.length);
    for (const hash of set.groups.values()) expect(hash).toMatch(/^[0-9a-f]{12}$/);
  });

  it('is deterministic', () => {
    expect([...gradingSet(allTemplates).groups]).toEqual([...gradingSet(allTemplates).groups]);
  });
});
