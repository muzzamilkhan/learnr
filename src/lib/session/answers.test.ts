import { describe, it, expect } from 'vitest';
import { answerMode, answerOptions, formatAnswer } from './answers';
import type { Question } from '../templates/types';

const question = (overrides: Partial<Question>): Question => ({
  templateId: 't',
  subject: 'maths',
  topic: 'addition',
  level: 'K',
  prompt: 'q',
  answer: 4,
  answerType: 'number',
  vars: {},
  ...overrides,
});

describe('answerMode', () => {
  it('types numbers and free text, taps choices and true/false', () => {
    expect(answerMode(question({}))).toBe('number');
    expect(answerMode(question({ answerType: 'text', answer: 'even' }))).toBe('text');
    expect(answerMode(question({ answerType: 'boolean', answer: true }))).toBe('tap');
    expect(answerMode(question({ answerType: 'choice', choices: [1, 2] }))).toBe('tap');
  });

  it('taps whenever choices are present, even if the answer is a number', () => {
    expect(answerMode(question({ choices: [4, 5, 6] }))).toBe('tap');
  });
});

describe('answerOptions', () => {
  it('offers True and False for a boolean question', () => {
    expect(answerOptions(question({ answerType: 'boolean', answer: false }))).toEqual([
      { value: 'true', label: 'True' },
      { value: 'false', label: 'False' },
    ]);
  });

  it('offers the generated choices, in the order they were shuffled into', () => {
    const options = answerOptions(question({ answerType: 'choice', answer: 4, choices: [7, 4, 9] }));
    expect(options.map((o) => o.label)).toEqual(['7', '4', '9']);
    expect(options.map((o) => o.value)).toEqual(['7', '4', '9']);
  });

  it('offers nothing for a typed question', () => {
    expect(answerOptions(question({}))).toEqual([]);
  });
});

describe('formatAnswer', () => {
  it('shows booleans as True and False rather than raw values', () => {
    expect(formatAnswer(question({ answerType: 'boolean', answer: true }))).toBe('True');
    expect(formatAnswer(question({ answerType: 'boolean', answer: false }))).toBe('False');
  });

  it('shows numbers and text as they are', () => {
    expect(formatAnswer(question({ answer: 42 }))).toBe('42');
    expect(formatAnswer(question({ answerType: 'text', answer: 'even' }))).toBe('even');
  });
});
