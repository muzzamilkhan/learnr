import { describe, it, expect } from 'vitest';
import { validateTemplates } from '@/lib/templates/validate';
import { generateQuestion } from '@/lib/templates/generate';
import { createRng } from '@/lib/rng';
import { allTemplates, listSubjects, templatesFor } from './catalog';

describe('shipped content', () => {
  it('every template is valid', () => {
    const result = validateTemplates(allTemplates);
    expect(result.errors).toEqual([]);
  });

  it('every template generates sane questions across many seeds', () => {
    for (const template of allTemplates) {
      for (let i = 0; i < 25; i++) {
        const q = generateQuestion(template, createRng(`${template.id}-${i}`));
        expect(q.prompt).not.toContain('{');
        expect(q.prompt.length).toBeGreaterThan(0);
        expect(q.answer).not.toBe('');
      }
    }
  });

  it('never asks a child for a negative or fractional answer', () => {
    for (const template of allTemplates) {
      for (let i = 0; i < 25; i++) {
        const { answer } = generateQuestion(template, createRng(`${template.id}-neg-${i}`));
        expect(typeof answer).toBe('number');
        expect(answer as number).toBeGreaterThanOrEqual(0);
        expect(Number.isInteger(answer)).toBe(true);
      }
    }
  });

  it('exposes maths with contiguous levels that each have templates', () => {
    const subjects = listSubjects();
    const maths = subjects.find((s) => s.subject === 'maths');

    expect(maths).toBeDefined();
    expect(maths!.levels.map((l) => l.level)).toEqual([1, 2, 3, 4, 5, 6]);
    for (const level of maths!.levels) {
      expect(level.templateCount).toBeGreaterThan(0);
      expect(level.categories.length).toBeGreaterThan(0);
    }
  });

  it('looks up templates by subject and level', () => {
    expect(templatesFor('maths', 1).every((t) => t.level === 1)).toBe(true);
    expect(templatesFor('maths', 99)).toEqual([]);
    expect(templatesFor('spelling', 1)).toEqual([]);
  });
});
