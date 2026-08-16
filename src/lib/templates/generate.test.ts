import { describe, it, expect } from 'vitest';
import { createRng } from '../rng';
import { generateQuestion } from './generate';
import type { QuestionTemplate } from './types';

const subtraction: QuestionTemplate = {
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

describe('generateQuestion', () => {
  it('binds variables, honours constraints and renders the prompt', () => {
    const q = generateQuestion(subtraction, createRng('seed-1'));

    expect(q.prompt).toMatch(/^What is the difference between \d+ and \d+\?$/);
    expect(q.vars.x).toBeGreaterThan(q.vars.y as number);
    expect(q.answer).toBe((q.vars.x as number) - (q.vars.y as number));
    expect(q.templateId).toBe('sub-basic');
    expect(q.answerType).toBe('number');
  });

  it('satisfies constraints across many draws', () => {
    for (let i = 0; i < 200; i++) {
      const q = generateQuestion(subtraction, createRng(`seed-${i}`));
      const x = q.vars.x as number;
      const y = q.vars.y as number;
      expect(x).toBeGreaterThan(y);
      expect(x).toBeGreaterThanOrEqual(5);
      expect(x).toBeLessThanOrEqual(10);
      expect(y).toBeGreaterThanOrEqual(5);
      expect(y).toBeLessThanOrEqual(10);
    }
  });

  it('is deterministic for a given seed', () => {
    const a = generateQuestion(subtraction, createRng('same'));
    const b = generateQuestion(subtraction, createRng('same'));
    expect(a).toEqual(b);
  });

  it('lets bounds reference earlier variables', () => {
    const template: QuestionTemplate = {
      ...subtraction,
      vars: [
        { name: 'x', kind: 'int', min: '2', max: '20' },
        { name: 'y', kind: 'int', min: '1', max: 'x - 1' },
      ],
      constraints: [],
    };

    for (let i = 0; i < 50; i++) {
      const q = generateQuestion(template, createRng(`bounds-${i}`));
      expect(q.vars.y as number).toBeLessThan(q.vars.x as number);
      expect(q.vars.y as number).toBeGreaterThanOrEqual(1);
    }
  });

  it('supports derived variables and expressions inside the prompt', () => {
    const template: QuestionTemplate = {
      id: 'derived',
      subject: 'maths',
      topic: 'addition',
      level: 'K',
      prompt: 'Sam has {x} apples and buys {y} more. Does he now have {total}?',
      vars: [
        { name: 'x', kind: 'int', min: '1', max: '5' },
        { name: 'y', kind: 'int', min: '1', max: '5' },
        { name: 'total', kind: 'expr', expr: 'x + y' },
      ],
      answer: 'total',
    };

    const q = generateQuestion(template, createRng('derived'));
    expect(q.vars.total).toBe((q.vars.x as number) + (q.vars.y as number));
    expect(q.prompt).toContain(`Does he now have ${q.vars.total}?`);
  });

  it('supports pick variables, including string operators', () => {
    const template: QuestionTemplate = {
      id: 'pick',
      subject: 'maths',
      topic: 'mixed',
      level: '1',
      prompt: 'What is {x} {op} {y}?',
      vars: [
        { name: 'x', kind: 'int', min: '1', max: '9' },
        { name: 'y', kind: 'int', min: '1', max: '9' },
        { name: 'op', kind: 'pick', from: ['+', '-'] },
      ],
      answer: "op == '+' ? x + y : x - y",
    };

    for (let i = 0; i < 30; i++) {
      const q = generateQuestion(template, createRng(`pick-${i}`));
      const { x, y, op } = q.vars as { x: number; y: number; op: string };
      expect(['+', '-']).toContain(op);
      expect(q.answer).toBe(op === '+' ? x + y : x - y);
      expect(q.prompt).toBe(`What is ${x} ${op} ${y}?`);
    }
  });

  it('generates multiple choice options that include the answer', () => {
    const template: QuestionTemplate = {
      ...subtraction,
      answerType: 'choice',
      choices: { count: 4, distractors: ['x + y', 'x', 'y'], jitter: { min: '1', max: '5' } },
    };

    const q = generateQuestion(template, createRng('choices'));
    expect(q.choices).toHaveLength(4);
    expect(q.choices).toContain(q.answer);
    expect(new Set(q.choices).size).toBe(4);
  });

  // Generation runs mid-session with a child waiting, so the cases below degrade
  // to something playable rather than throwing. `validateTemplate` is where an
  // author is told about them.
  it('never offers more than four options, whatever the template asked for', () => {
    const template: QuestionTemplate = {
      ...subtraction,
      answerType: 'choice',
      choices: { count: 9, jitter: { min: '1', max: '20' } },
    };

    const q = generateQuestion(template, createRng('too-many'));
    expect(q.choices).toHaveLength(4);
    expect(q.choices).toContain(q.answer);
  });

  it('infers a true/false question from a boolean answer', () => {
    const template: QuestionTemplate = {
      id: 'even',
      subject: 'maths',
      topic: 'even and odd',
      level: 'K',
      prompt: 'True or false: {x} is an even number.',
      vars: [{ name: 'x', kind: 'int', min: '1', max: '20' }],
      answer: 'isEven(x)',
    };

    for (let i = 0; i < 30; i++) {
      const q = generateQuestion(template, createRng(`bool-${i}`));
      expect(q.answerType).toBe('boolean');
      expect(q.answer).toBe((q.vars.x as number) % 2 === 0);
      // True/false draws its own two buttons; it is not a choice question.
      expect(q.choices).toBeUndefined();
    }
  });

  it('drops choices on a true/false question rather than failing the draw', () => {
    const template: QuestionTemplate = {
      ...subtraction,
      constraints: [],
      answer: 'x > y',
      choices: { count: 4, distractors: ['1', '2', '3'] },
    };

    const q = generateQuestion(template, createRng('bool-choices'));
    expect(q.answerType).toBe('boolean');
    expect(q.choices).toBeUndefined();
  });

  it('throws a useful error when constraints can never be met', () => {
    const impossible: QuestionTemplate = {
      ...subtraction,
      constraints: ['x > 1000'],
    };
    expect(() => generateQuestion(impossible, createRng('nope'))).toThrow(
      /sub-basic.*constraint/is,
    );
  });

  it('renders hints when present', () => {
    const q = generateQuestion(
      { ...subtraction, hint: 'Count back from {x}.' },
      createRng('hint'),
    );
    expect(q.hint).toBe(`Count back from ${q.vars.x}.`);
  });
});
