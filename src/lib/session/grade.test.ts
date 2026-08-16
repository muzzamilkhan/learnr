import { describe, it, expect } from 'vitest';
import { gradeAnswer } from './grade';
import type { Question } from '../templates/types';

const numeric = (answer: number): Question => ({
  templateId: 't',
  subject: 'maths',
  topic: 'subtraction',
  level: 'K',
  prompt: 'q',
  answer,
  answerType: 'number',
  vars: {},
});

const text = (answer: string): Question => ({ ...numeric(0), answer, answerType: 'text' });

const boolean = (answer: boolean): Question => ({
  ...numeric(0),
  answer,
  answerType: 'boolean',
});

describe('gradeAnswer', () => {
  it('accepts the exact numeric answer', () => {
    expect(gradeAnswer(numeric(4), '4').correct).toBe(true);
    expect(gradeAnswer(numeric(4), '5').correct).toBe(false);
  });

  it('tolerates whitespace and leading zeros', () => {
    expect(gradeAnswer(numeric(4), ' 4 ').correct).toBe(true);
    expect(gradeAnswer(numeric(4), '04').correct).toBe(true);
  });

  it('accepts equivalent decimal spellings', () => {
    expect(gradeAnswer(numeric(0.5), '.5').correct).toBe(true);
    expect(gradeAnswer(numeric(2), '2.0').correct).toBe(true);
  });

  it('handles negative answers', () => {
    expect(gradeAnswer(numeric(-3), '-3').correct).toBe(true);
    expect(gradeAnswer(numeric(-3), '3').correct).toBe(false);
  });

  it('treats blank and non-numeric responses as incorrect, not as errors', () => {
    expect(gradeAnswer(numeric(4), '').correct).toBe(false);
    expect(gradeAnswer(numeric(4), 'four').correct).toBe(false);
    expect(gradeAnswer(numeric(4), '  ').correct).toBe(false);
  });

  it('compares text answers case-insensitively', () => {
    expect(gradeAnswer(text('Yes'), 'yes').correct).toBe(true);
    expect(gradeAnswer(text('Yes'), ' YES ').correct).toBe(true);
    expect(gradeAnswer(text('Yes'), 'no').correct).toBe(false);
  });

  it('grades true/false answers', () => {
    expect(gradeAnswer(boolean(true), 'true').correct).toBe(true);
    expect(gradeAnswer(boolean(true), 'false').correct).toBe(false);
    expect(gradeAnswer(boolean(false), 'false').correct).toBe(true);
  });

  it('accepts the labels a child actually taps for true/false', () => {
    expect(gradeAnswer(boolean(true), 'True').correct).toBe(true);
    expect(gradeAnswer(boolean(true), ' YES ').correct).toBe(true);
    expect(gradeAnswer(boolean(false), 'No').correct).toBe(true);
    expect(gradeAnswer(boolean(true), 'maybe').correct).toBe(false);
    expect(gradeAnswer(boolean(true), '').correct).toBe(false);
  });

  it('reports the normalised response for recording', () => {
    expect(gradeAnswer(numeric(4), ' 04 ').response).toBe('04');
  });
});
