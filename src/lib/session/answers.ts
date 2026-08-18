import type { Question } from '../templates/types';

/**
 * How a question is answered, decided from the question itself so the play screen
 * only has to render what it is told. Pure, like everything else in `lib`.
 */

/** Values are graded and recorded; labels are what the child reads. */
export interface AnswerOption {
  value: string;
  label: string;
}

export const BOOLEAN_OPTIONS: readonly AnswerOption[] = [
  { value: 'true', label: 'True' },
  { value: 'false', label: 'False' },
];

export type AnswerMode = 'number' | 'text' | 'tap';

/**
 * `tap` answers commit on the first touch - there is nothing to review, so no
 * Check button. `number` and `text` are typed and then checked.
 */
export function answerMode(question: Question): AnswerMode {
  if (question.answerType === 'boolean' || question.choices) return 'tap';
  return question.answerType === 'text' ? 'text' : 'number';
}

/** The buttons to render for a tapped question; empty for a typed one. */
export function answerOptions(question: Question): readonly AnswerOption[] {
  if (question.answerType === 'boolean') return BOOLEAN_OPTIONS;
  return (question.choices ?? []).map((choice) => ({
    value: String(choice),
    label: String(choice),
  }));
}

/** The correct answer as a child should read it, e.g. after getting it wrong. */
export function formatAnswer(question: Question): string {
  if (typeof question.answer === 'boolean') return question.answer ? 'True' : 'False';
  return String(question.answer);
}

/** Longest typed number, e.g. "1234.56". Long enough for any answer we ask for. */
export const MAX_NUMBER_LENGTH = 8;

/**
 * Add one keypress to a typed number. Digits, a single leading minus and at most
 * one decimal point get through; anything else leaves the entry alone, so the pad
 * and a physical keyboard can share one rule.
 */
export function appendNumeric(entry: string, key: string): string {
  if (entry.length >= MAX_NUMBER_LENGTH) return entry;
  // A bare "." is not a number a child would write, so seed the zero for them.
  if (key === '.') return entry.includes('.') ? entry : entry === '' ? '0.' : `${entry}.`;
  if (key === '-') return entry === '' ? '-' : entry;
  return key >= '0' && key <= '9' ? entry + key : entry;
}
