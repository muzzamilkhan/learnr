import { describe, expect, it } from 'vitest';
import { createRng } from '../rng';
import { generate } from '../templates/generate';
import { validateSpec } from '../templates/validate';
import {
  MODES,
  modeKey,
  modeLabel,
  modesFor,
  parseMode,
  parseOperation,
  specsFor,
  type Mode,
} from './modes';

/** Every question a mode can produce, over enough draws to trust the bounds. */
function draws(mode: Mode, count = 200) {
  const specs = specsFor(mode);
  return Array.from({ length: count }, (_, i) => {
    const rng = createRng(`${modeKey(mode)}:${i}`);
    return generate(specs[i % specs.length], rng);
  });
}

describe('the mode space', () => {
  it('is exactly 27 modes', () => {
    expect(MODES).toHaveLength(27);
  });

  it('has a unique key for every mode', () => {
    expect(new Set(MODES.map(modeKey)).size).toBe(27);
  });

  it('round-trips every key through parseMode', () => {
    for (const mode of MODES) {
      expect(parseMode(modeKey(mode))).toEqual(mode);
    }
  });

  it('refuses keys that are not modes', () => {
    for (const junk of ['', 'add', 'add.trivial', 'multiply.13', 'multiply.1', 'multiply.easy', 'records', '__proto__']) {
      expect(parseMode(junk)).toBeNull();
    }
  });

  it('offers 15 multiplication modes and 3 of each other', () => {
    expect(modesFor('multiply')).toHaveLength(15);
    for (const op of ['add', 'subtract', 'divide', 'mixed'] as const) {
      expect(modesFor(op)).toHaveLength(3);
    }
  });

  it('names every mode', () => {
    expect(modeLabel({ op: 'multiply', tables: 7 })).toBe('7 times table');
    expect(modeLabel({ op: 'multiply', tables: 'all' })).toBe('All tables');
    expect(modeLabel({ op: 'add', difficulty: 'easy' })).toBe('Easy');
  });

  it('parses operations at the boundary', () => {
    expect(parseOperation('multiply')).toBe('multiply');
    expect(parseOperation('records')).toBeNull();
    expect(parseOperation('MULTIPLY')).toBeNull();
  });
});

describe('every mode generates valid questions', () => {
  it.each(MODES.map((m) => [modeKey(m), m] as const))('%s', (_key, mode) => {
    for (const spec of specsFor(mode)) {
      expect(validateSpec(spec).errors).toEqual([]);
    }

    for (const question of draws(mode)) {
      expect(question.answerType).toBe('number');
      expect(typeof question.answer).toBe('number');
      expect(Number.isInteger(question.answer)).toBe(true);
      // The number pad has no minus key.
      expect(question.answer as number).toBeGreaterThanOrEqual(0);
      expect(question.choices).toBeUndefined();
    }
  });
});

describe('the difficulty bands mean what they say', () => {
  it('never asks for a negative difference', () => {
    for (const difficulty of ['easy', 'moderate', 'hard'] as const) {
      for (const q of draws({ op: 'subtract', difficulty })) {
        expect(q.vars.x as number).toBeGreaterThanOrEqual(q.vars.y as number);
      }
    }
  });

  it('divides exactly, every time', () => {
    for (const difficulty of ['easy', 'moderate', 'hard'] as const) {
      for (const q of draws({ op: 'divide', difficulty })) {
        expect((q.vars.x as number) % (q.vars.d as number)).toBe(0);
      }
    }
  });

  it('makes hard addition carry and hard subtraction borrow', () => {
    for (const q of draws({ op: 'add', difficulty: 'hard' })) {
      expect(((q.vars.x as number) % 10) + ((q.vars.y as number) % 10)).toBeGreaterThan(9);
    }
    for (const q of draws({ op: 'subtract', difficulty: 'hard' })) {
      expect((q.vars.x as number) % 10).toBeLessThan((q.vars.y as number) % 10);
    }
  });

  it('keeps every multiplication draw inside its chosen tables', () => {
    const sets: [Mode, number[]][] = [
      [{ op: 'multiply', tables: 7 }, [7]],
      [{ op: 'multiply', tables: '2-5' }, [2, 3, 4, 5]],
      [{ op: 'multiply', tables: '6-9' }, [6, 7, 8, 9]],
      [{ op: 'multiply', tables: '10-12' }, [10, 11, 12]],
      [{ op: 'multiply', tables: 'all' }, [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]],
    ];

    for (const [mode, tables] of sets) {
      for (const q of draws(mode)) {
        expect(tables).toContain(q.vars.t as number);
        expect(q.vars.n as number).toBeGreaterThanOrEqual(1);
        expect(q.vars.n as number).toBeLessThanOrEqual(12);
      }
    }
  });

  it('draws all four operations in a mixed run', () => {
    for (const difficulty of ['easy', 'moderate', 'hard'] as const) {
      const prompts = draws({ op: 'mixed', difficulty }).map((q) => q.prompt);
      for (const sign of ['+', '−', '×', '÷']) {
        expect(prompts.some((p) => p.includes(sign))).toBe(true);
      }
    }
  });
});
