import { describe, expect, it } from 'vitest';
import { createRng } from '../rng';
import { generate } from '../templates/generate';
import { validateSpec } from '../templates/validate';
import {
  MODES,
  modeKey,
  isSingleTable,
  modeLabel,
  modesFor,
  parseMode,
  parseOperation,
  specsFor,
  operationLabel,
  operationNoun,
  OPERATIONS,
  type Mode,
} from './modes';
import { answerRun, startRun } from './run';

/** Every question a mode can produce, over enough draws to trust the bounds. */
function draws(mode: Mode, count = 200) {
  const specs = specsFor(mode);
  return Array.from({ length: count }, (_, i) => {
    const rng = createRng(`${modeKey(mode)}:${i}`);
    return generate(specs[i % specs.length], rng);
  });
}

describe('the mode space', () => {
  it('is exactly 26 modes', () => {
    expect(MODES).toHaveLength(26);
  });

  it('has a unique key for every mode', () => {
    expect(new Set(MODES.map(modeKey)).size).toBe(26);
  });

  // Multiplying by ten is a place-value rule rather than a fact to recall, so
  // a whole run of it measures typing speed. It is gone from the drills and
  // from the top bundle - a third of that run would otherwise be free - and it
  // stays in `all`, which would be lying without it.
  it('drills no tens, in a table of its own or in a bundle', () => {
    expect(parseMode('multiply.10')).toBeNull();
    expect(parseMode('multiply.10-12')).toBeNull();
    expect(MODES).not.toContainEqual({ op: 'multiply', tables: 10 });

    const prompts = (mode: Mode) => draws(mode, 400).map((question) => question.prompt);
    expect(prompts({ op: 'multiply', tables: '11-12' }).some((p) => p.startsWith('10 ×'))).toBe(
      false,
    );
    expect(prompts({ op: 'multiply', tables: 'all' }).some((p) => p.startsWith('10 ×'))).toBe(true);
  });

  it('round-trips every key through parseMode', () => {
    for (const mode of MODES) {
      expect(parseMode(modeKey(mode))).toEqual(mode);
    }
  });

  it('refuses keys that are not modes', () => {
    for (const junk of ['', 'add', 'add.trivial', 'multiply.13', 'multiply.1', 'multiply.10', 'multiply.easy', 'records', '__proto__']) {
      expect(parseMode(junk)).toBeNull();
    }
  });

  it('offers 14 multiplication modes and 3 of each other', () => {
    expect(modesFor('multiply')).toHaveLength(14);
    for (const op of ['add', 'subtract', 'divide', 'mixed'] as const) {
      expect(modesFor(op)).toHaveLength(3);
    }
  });

  it('names every mode', () => {
    // A single table is written the way it is said, so a run of them can be
    // scanned rather than read; a bundle keeps the same notation at both ends
    // so it reads as a run of those chips rather than a different kind of thing.
    expect(modeLabel({ op: 'multiply', tables: 7 })).toBe('7x');
    expect(modeLabel({ op: 'multiply', tables: '2-5' })).toBe('2x to 5x');
    expect(modeLabel({ op: 'multiply', tables: '6-9' })).toBe('6x to 9x');
    expect(modeLabel({ op: 'multiply', tables: '11-12' })).toBe('11x to 12x');
    expect(modeLabel({ op: 'multiply', tables: 'all' })).toBe('All tables');
    expect(modeLabel({ op: 'add', difficulty: 'easy' })).toBe('Easy');
  });

  it('tells a single table from everything else', () => {
    // What the picker asks, so it can give the short labels a dense grid and
    // the long ones a wide row.
    expect(modesFor('multiply').filter(isSingleTable)).toHaveLength(10);
    expect(isSingleTable({ op: 'multiply', tables: 7 })).toBe(true);
    expect(isSingleTable({ op: 'multiply', tables: '2-5' })).toBe(false);
    expect(isSingleTable({ op: 'multiply', tables: 'all' })).toBe(false);
    expect(isSingleTable({ op: 'add', difficulty: 'easy' })).toBe(false);
  });

  it('parses operations at the boundary', () => {
    expect(parseOperation('multiply')).toBe('multiply');
    expect(parseOperation('records')).toBeNull();
    expect(parseOperation('MULTIPLY')).toBeNull();
  });

  it('labels a control with the verb', () => {
    // What a card, a heading or a button says: press this and you are doing it.
    expect(OPERATIONS.map(operationLabel)).toEqual([
      'Add',
      'Subtract',
      'Multiply',
      'Divide',
      'Mixed',
    ]);
  });

  it('names an operation in prose with the noun', () => {
    // `recordBanners` drops this into "a personal best in ___", where the verb
    // would not be English.
    expect(operationNoun('add')).toBe('addition');
    expect(operationNoun('divide')).toBe('division');
    for (const op of OPERATIONS) expect(operationNoun(op)).toBe(operationNoun(op).toLowerCase());
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
      [{ op: 'multiply', tables: '11-12' }, [11, 12]],
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

  // Through `startRun`/`answerRun` rather than the `draws` helper above: the
  // helper round-robins `specs[i % specs.length]` itself, so it never touches
  // `drawQuestion`'s `rng.pick(specs)` in `run.ts` - the only place a mixed
  // run actually chooses between its four operations. This walks the real
  // path, the way a run in progress does.
  it('draws all four operations in a mixed run', () => {
    for (const difficulty of ['easy', 'moderate', 'hard'] as const) {
      const mode: Mode = { op: 'mixed', difficulty };
      let state = startRun({ mode, seed: `mixed-${difficulty}`, startedAt: 0 });
      const prompts = [state.current.prompt, state.next.prompt];
      for (let i = 0; i < 200; i++) {
        state = answerRun(state, String(state.current.answer), 0);
        prompts.push(state.current.prompt);
      }

      for (const sign of ['+', '−', '×', '÷']) {
        expect(prompts.some((p) => p.includes(sign))).toBe(true);
      }
    }
  });
});
