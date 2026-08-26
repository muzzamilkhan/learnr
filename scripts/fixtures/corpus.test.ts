import { describe, expect, it } from 'vitest';
import { allTemplates } from '../../src/content/catalog';
import { corpusCases, DRAWS, seedFor } from './corpus';
import { canonicaliseCase, canonicalQuestion } from './canonical';
import { createRng } from '../../src/lib/rng';
import { generateQuestion } from '../../src/lib/templates/generate';

const template = allTemplates.find((t) => t.id === 'maths.1.subtraction.difference')!;

describe('seedFor', () => {
  it('is the template id and the draw, which is contract', () => {
    expect(seedFor('maths.3.fractions.half', 7)).toBe('maths.3.fractions.half:7');
  });
});

describe('corpusCases', () => {
  it('draws a hundred times', () => {
    expect(corpusCases(template)).toHaveLength(DRAWS);
  });

  it('is deterministic, which is the whole premise', () => {
    expect(corpusCases(template)).toEqual(corpusCases(template));
  });

  it('names the fields of every case', () => {
    for (const line of corpusCases(template)) {
      expect(line).toContain('prompt');
      expect(line).toContain('answer');
      expect(line).toContain('answerType');
    }
  });

  it('varies, so a hundred identical draws would not pass unnoticed', () => {
    expect(new Set(corpusCases(template)).size).toBeGreaterThan(1);
  });

  it('carries a figure where the template has one', () => {
    const withFigure = allTemplates.find((t) => t.figure)!;
    expect(corpusCases(withFigure).every((line) => line.includes('figure.width'))).toBe(true);
  });

  it('seeds each draw from its own seed, not one Rng walked across all hundred', () => {
    const cases = corpusCases(template);
    for (const draw of [0, 7, 42, 99]) {
      const expected = canonicaliseCase(
        canonicalQuestion(generateQuestion(template, createRng(seedFor(template.id, draw)))),
      );
      expect(cases[draw]).toBe(expected);
    }
  });
});
