import type { Question } from '../templates/types';

export interface Grade {
  correct: boolean;
  /** The child's response, trimmed — recorded as typed for later analysis. */
  response: string;
}

/** Floating point answers only ever come from decimal templates, so this is generous enough. */
const EPSILON = 1e-9;

/**
 * What a child may have tapped or typed for a true/false question. The play screen
 * sends "true"/"false", but a template could label the buttons yes/no, and a
 * physical keyboard could type either — so accept both spellings.
 */
const TRUTHY = new Set(['true', 'yes', 't', 'y']);
const FALSY = new Set(['false', 'no', 'f', 'n']);

export function gradeAnswer(question: Question, response: string): Grade {
  const trimmed = response.trim();

  if (question.answerType === 'boolean' || typeof question.answer === 'boolean') {
    const said = trimmed.toLowerCase();
    const correct = question.answer === true ? TRUTHY.has(said) : FALSY.has(said);
    return { correct, response: trimmed };
  }

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
