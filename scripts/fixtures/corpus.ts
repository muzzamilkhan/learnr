import { createRng } from '../../src/lib/rng';
import { generateQuestion } from '../../src/lib/templates/generate';
import type { QuestionTemplate } from '../../src/lib/templates/types';
import { canonicaliseCase, canonicalQuestion } from './canonical';

/**
 * A hundred draws a template. Coverage flattens well before that - a template
 * averages 20.3 distinct outputs over 25 draws and 67.8 over 100 - but the
 * committed artifact is a digest whose size does not depend on the draw count,
 * and generation is under three seconds, so the redundancy costs nothing.
 */
export const DRAWS = 100;

/**
 * **This string is contract, not an implementation detail**, because `createRng`
 * hashes the string itself. It differs deliberately from how a live session
 * seeds a draw (`${sessionSeed}:${drawNumber}`): a fixture needs a seed stable
 * across regeneration and independent of any session.
 */
export const seedFor = (templateId: string, draw: number): string => `${templateId}:${draw}`;

export function corpusCases(template: QuestionTemplate): string[] {
  const cases: string[] = [];
  for (let draw = 0; draw < DRAWS; draw++) {
    const question = generateQuestion(template, createRng(seedFor(template.id, draw)));
    cases.push(canonicaliseCase(canonicalQuestion(question)));
  }
  return cases;
}
