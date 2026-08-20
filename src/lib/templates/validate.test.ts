import { describe, it, expect } from 'vitest';
import { validateSpec, validateTemplate } from './validate';
import type { QuestionTemplate } from './types';

const valid: QuestionTemplate = {
  id: 'sub-basic',
  subject: 'maths',
  topic: 'subtraction',
  level: 'K',
  prompt: 'What is the difference between {x} and {y}?',
  vars: [
    { name: 'x', kind: 'int', min: '5', max: '10' },
    { name: 'y', kind: 'int', min: '5', max: '10' },
  ],
  constraints: ['x > y'],
  answer: 'x - y',
};

const errorsFor = (template: unknown) => validateTemplate(template).errors;

describe('validateTemplate', () => {
  it('accepts a well formed template', () => {
    const result = validateTemplate(valid);
    expect(result.errors).toEqual([]);
    expect(result.valid).toBe(true);
  });

  it('requires the identifying fields', () => {
    expect(errorsFor({ ...valid, id: '' })).toContainEqual(expect.stringMatching(/id/i));
    expect(errorsFor({ ...valid, subject: '' })).toContainEqual(expect.stringMatching(/subject/i));
    expect(errorsFor({ ...valid, topic: '' })).toContainEqual(expect.stringMatching(/topic/i));
  });

  it('requires level to be a school year, not a number or an invented year', () => {
    expect(errorsFor({ ...valid, level: 1 })).toContainEqual(expect.stringMatching(/level/i));
    expect(errorsFor({ ...valid, level: '13' })).toContainEqual(expect.stringMatching(/level/i));
    expect(errorsFor({ ...valid, level: 'kindy' })).toContainEqual(expect.stringMatching(/level/i));
    expect(errorsFor({ ...valid, level: '6' })).toEqual([]);
  });

  it('rejects duplicate variable names', () => {
    const template = { ...valid, vars: [...valid.vars, { name: 'x', kind: 'int', min: '1', max: '2' }] };
    expect(errorsFor(template)).toContainEqual(expect.stringMatching(/duplicate variable.*x/i));
  });

  it('rejects expressions that reference unbound variables', () => {
    expect(errorsFor({ ...valid, answer: 'x - z' })).toContainEqual(
      expect.stringMatching(/unknown variable: z/i),
    );
    expect(errorsFor({ ...valid, prompt: 'What is {q}?' })).toContainEqual(
      expect.stringMatching(/unknown variable: q/i),
    );
  });

  it('rejects a variable referencing one declared after it', () => {
    const template = {
      ...valid,
      vars: [
        { name: 'x', kind: 'int', min: '1', max: 'y' },
        { name: 'y', kind: 'int', min: '1', max: '9' },
      ],
    };
    expect(errorsFor(template)).toContainEqual(expect.stringMatching(/unknown variable: y/i));
  });

  it('rejects malformed expressions', () => {
    expect(errorsFor({ ...valid, answer: 'x -' })).toContainEqual(
      expect.stringMatching(/answer/i),
    );
  });

  it('rejects a pick list that is empty', () => {
    const template = { ...valid, vars: [{ name: 'op', kind: 'pick', from: [] }], answer: '1' };
    expect(errorsFor(template)).toContainEqual(expect.stringMatching(/op.*empty|empty.*op/i));
  });

  it('accepts a true/false template', () => {
    const template = {
      ...valid,
      prompt: 'Is {x} bigger than {y}?',
      constraints: [],
      answer: 'x > y',
    };
    expect(errorsFor(template)).toEqual([]);
  });

  it('caps multiple choice at four options, which is what the screen fits', () => {
    const choice = (count: number) => ({
      ...valid,
      answerType: 'choice' as const,
      choices: { count, jitter: { min: '1', max: '9' } },
    });

    expect(errorsFor(choice(2))).toEqual([]);
    expect(errorsFor(choice(4))).toEqual([]);
    expect(errorsFor(choice(1))).toContainEqual(expect.stringMatching(/choices\.count/i));
    expect(errorsFor(choice(5))).toContainEqual(expect.stringMatching(/choices\.count/i));
  });

  it('rejects choices on a true/false template, which already has its two options', () => {
    const boolean = { ...valid, constraints: undefined, answer: 'isEven(x)' };
    expect(errorsFor(boolean)).toEqual([]);

    // Caught whether the author declared the type or left it to be inferred.
    expect(
      errorsFor({ ...boolean, answerType: 'boolean', choices: { count: 2, distractors: ['1'] } }),
    ).toContainEqual(expect.stringMatching(/true\/false|boolean/i));
    expect(errorsFor({ ...boolean, choices: { count: 2, distractors: ['1'] } })).toContainEqual(
      expect.stringMatching(/true\/false|boolean/i),
    );
  });

  it('reports an answerType that disagrees with what the answer evaluates to', () => {
    // Generation coerces these so a session never crashes, so validation is the
    // only place an author finds out.
    expect(errorsFor({ ...valid, answerType: 'boolean' })).toContainEqual(
      expect.stringMatching(/answerType/i),
    );
    expect(
      errorsFor({ ...valid, constraints: [], answer: 'x > y', answerType: 'number' }),
    ).toContainEqual(expect.stringMatching(/answerType/i));
    expect(
      errorsFor({
        ...valid,
        constraints: [],
        answer: 'x > y',
        answerType: 'choice',
        choices: { count: 2, distractors: ['1'] },
      }),
    ).toContainEqual(expect.stringMatching(/answerType|true\/false|boolean/i));

    // `choice` and `text` accept a number or a string, so neither is a mismatch.
    expect(errorsFor({ ...valid, answerType: 'text' })).toEqual([]);
  });

  it('rejects a multiple choice template with nothing to choose from', () => {
    expect(errorsFor({ ...valid, answerType: 'choice' })).toContainEqual(
      expect.stringMatching(/choice.*requires choices/i),
    );
  });

  it('catches templates whose constraints can never be satisfied', () => {
    const template = { ...valid, constraints: ['x > 1000'] };
    expect(errorsFor(template)).toContainEqual(expect.stringMatching(/constraint/i));
  });

  it('reports every problem at once rather than stopping at the first', () => {
    const errors = errorsFor({ ...valid, id: '', subject: '', answer: 'nope' });
    expect(errors.length).toBeGreaterThanOrEqual(3);
  });

  it('rejects values that are not templates at all', () => {
    expect(errorsFor(null).length).toBeGreaterThan(0);
    expect(errorsFor('a string').length).toBeGreaterThan(0);
    expect(errorsFor({ ...valid, vars: 'not an array' }).length).toBeGreaterThan(0);
  });
});

describe('validateSpec', () => {
  it('accepts a spec with no id, subject, topic or level', () => {
    expect(
      validateSpec({
        prompt: '{x} + {y}',
        vars: [
          { name: 'x', kind: 'int', min: '1', max: '9' },
          { name: 'y', kind: 'int', min: '1', max: '9' },
        ],
        answer: 'x + y',
      }).valid,
    ).toBe(true);
  });

  it('still catches an unbound variable', () => {
    const result = validateSpec({
      prompt: '{x} + {z}',
      vars: [{ name: 'x', kind: 'int', min: '1', max: '9' }],
      answer: 'x + z',
    });
    expect(result.valid).toBe(false);
    expect(result.errors.join(' ')).toContain('z');
  });

  it('still catches constraints that can never be satisfied', () => {
    const result = validateSpec({
      prompt: '{x}',
      vars: [{ name: 'x', kind: 'int', min: '1', max: '9' }],
      constraints: ['x > 100'],
      answer: 'x',
    });
    expect(result.valid).toBe(false);
    expect(result.errors.join(' ')).toContain('generation failed');
  });
});

describe('validateTemplate figures', () => {
  // A regular shape has no free proportion, so a fixed name and a jittered
  // rotation are the whole story - which is exactly what should pass.
  const hexagon: QuestionTemplate = {
    ...valid,
    id: 'hexagon',
    prompt: 'What shape is this?',
    vars: [],
    constraints: [],
    answer: "'hexagon'",
    figure: { kind: 'polygon', shape: "'hexagon'" },
  };

  it('accepts a well formed figure template', () => {
    expect(errorsFor(hexagon)).toEqual([]);
  });

  it('rejects an unknown figure kind', () => {
    const template = { ...hexagon, figure: { kind: 'triangle', shape: "'hexagon'" } };
    expect(errorsFor(template)).toContainEqual(expect.stringMatching(/figure\.kind.*not a figure kind/i));
  });

  it('rejects a figure parameter that references an unbound variable', () => {
    const template = { ...hexagon, figure: { kind: 'polygon', shape: 'q' } };
    expect(errorsFor(template)).toContainEqual(expect.stringMatching(/figure\.shape.*unknown variable: q/i));
  });

  it('rejects a figure parameter that figureIssues would clamp', () => {
    const template = {
      ...hexagon,
      answer: "'reflex'",
      figure: { kind: 'angle', degrees: '500' },
    };
    expect(errorsFor(template)).toContainEqual(
      expect.stringMatching(/figure\.degrees.*500.*outside 1-359/i),
    );
  });

  it('catches a pinned rotation on a regular polygon as an anchored diagram', () => {
    // A regular hexagon's proportions are fixed by its name; pinning rotation
    // too leaves nothing left to vary, so every draw is byte-identical.
    const pinned = { ...hexagon, figure: { ...hexagon.figure, rotation: '0' } };
    expect(errorsFor(pinned)).toContainEqual(
      expect.stringMatching(/every "hexagon" draws the same picture/i),
    );
  });

  it('passes the same template once the pin is removed', () => {
    expect(errorsFor(hexagon)).toEqual([]);
  });
});
