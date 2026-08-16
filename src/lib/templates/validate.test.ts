import { describe, it, expect } from 'vitest';
import { validateTemplate } from './validate';
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
    expect(errorsFor({ ...valid, level: '12' })).toEqual([]);
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

  it('allows between two and four choices, and no more', () => {
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

  it('rejects choices on a true/false template, which renders its own buttons', () => {
    const template = {
      ...valid,
      constraints: [],
      answer: 'x > y',
      answerType: 'boolean' as const,
      choices: { count: 2, distractors: ['x < y'] },
    };
    expect(errorsFor(template)).toContainEqual(expect.stringMatching(/choices.*boolean/i));
  });

  it('rejects an answerType that disagrees with what the answer evaluates to', () => {
    expect(errorsFor({ ...valid, answerType: 'boolean' })).toContainEqual(
      expect.stringMatching(/answerType/i),
    );
    expect(
      errorsFor({ ...valid, constraints: [], answer: 'x > y', answerType: 'number' }),
    ).toContainEqual(expect.stringMatching(/answerType/i));
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
