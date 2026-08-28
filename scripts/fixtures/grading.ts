import { createRng } from '../../src/lib/rng';
import { gradeAnswer } from '../../src/lib/session/grade';
import { generateQuestion } from '../../src/lib/templates/generate';
import type { Question, QuestionTemplate } from '../../src/lib/templates/types';
import { canonicaliseCase, canonicalQuoted, digest } from './canonical';
import { seedFor } from './corpus';
import type { DigestSet } from './digests';

/** What a child may have tapped or typed for a true/false question. */
const BOOLEAN_SPELLINGS = ['true', 'yes', 't', 'y', 'false', 'no', 'f', 'n'];

/**
 * The responses each question is graded against.
 *
 * The near-misses are the content. `gradeAnswer` compares a numeric answer with
 * `EPSILON` (1e-9), so `answer + 1e-10` must be correct and `answer + 1e-8` must
 * not - a port choosing a different tolerance, or comparing exactly, parts
 * company on exactly one of those two and on nothing else.
 */
export function responsesFor(question: Question): string[] {
  const answer = String(question.answer);
  const responses = [
    answer,
    ` ${answer} `,
    answer.toUpperCase(),
    answer.toLowerCase(),
    '',
    'abc',
    '0',
  ];

  if (question.answerType === 'boolean' || typeof question.answer === 'boolean') {
    responses.push(...BOOLEAN_SPELLINGS);
  }

  if (question.answerType === 'number' || typeof question.answer === 'number') {
    const n = Number(question.answer);
    responses.push(
      String(n + 1e-10),
      String(n - 1e-10),
      String(n + 1e-8),
      String(n - 1e-8),
      String(n + 1),
      `${n}.0`,
      `0${n}`,
    );
  }

  for (const choice of question.choices ?? []) responses.push(String(choice));

  return [...new Set(responses)];
}

/**
 * Draw 0 of every template - 507 questions, covering all four answer types -
 * each graded against its own response list.
 *
 * One draw a template rather than all hundred: grading reads the answer and the
 * answer type and nothing else about how the question was drawn, so the
 * hundredth draw exercises the same path as the first. What varies usefully is
 * the *response*, which is why that list is constructed rather than sampled.
 *
 * `response` and `recorded` go through `canonicalQuoted` rather than raw, because
 * a response is deliberately allowed to be empty or to carry padding: quoting
 * escapes any value that would otherwise collide with the canonical form's own
 * separators and throw from `canonicaliseCase`, and it makes leading and
 * trailing whitespace visible when reading a raw diff. It is these two
 * fields alone, and `canonicalQuoted` spells the escaping out rather than
 * calling `JSON.stringify`, so a port needs no JSON encoder to agree here.
 */
export function gradingSet(templates: readonly QuestionTemplate[]): DigestSet {
  const groups = new Map<string, string>();

  for (const template of templates) {
    const question = generateQuestion(template, createRng(seedFor(template.id, 0)));
    const cases = responsesFor(question).map((response) => {
      const grade = gradeAnswer(question, response);
      return canonicaliseCase([
        ['answer', String(question.answer)],
        ['answerType', question.answerType],
        ['response', canonicalQuoted(response)],
        ['correct', String(grade.correct)],
        ['recorded', canonicalQuoted(grade.response)],
      ]);
    });
    groups.set(template.id, digest(cases));
  }

  return { name: 'grading', groups, draws: 1 };
}
