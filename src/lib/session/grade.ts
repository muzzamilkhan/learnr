import type { Question } from '../templates/types';

export interface Grade {
  correct: boolean;
  /** The child's response, trimmed — recorded as typed for later analysis. */
  response: string;
}

/** Floating point answers only ever come from decimal templates, so this is generous enough. */
const EPSILON = 1e-9;

export function gradeAnswer(question: Question, response: string): Grade {
  const trimmed = response.trim();

  if (question.answerType === 'number' || typeof question.answer === 'number') {
    const parsed = Number(trimmed);
    const correct =
      trimmed !== '' && !Number.isNaN(parsed) && Math.abs(parsed - Number(question.answer)) < EPSILON;
    return { correct, response: trimmed };
  }

  return {
    correct: trimmed.toLowerCase() === String(question.answer).trim().toLowerCase(),
    response: trimmed,
  };
}
