import type { YearLevel } from '../curriculum';
import { createRng, type Rng } from '../rng';
import { generateQuestion } from '../templates/generate';
import type { Question, QuestionTemplate } from '../templates/types';
import { gradeAnswer } from './grade';

/**
 * A session has no end. Once a subject + level has templates, it draws from them
 * at random for as long as the child keeps going. All state transitions are pure:
 * the caller supplies the clock, so the engine stays testable.
 */

export interface Attempt {
  templateId: string;
  subject: string;
  topic: string;
  level: YearLevel;
  prompt: string;
  /** The expected answer, kept so a parent can review what was asked. */
  expected: string;
  response: string;
  correct: boolean;
  timeTakenMs: number;
  answeredAt: number;
}

export interface SessionState {
  subject: string;
  level: YearLevel;
  startedAt: number;
  /** When the current question was put on screen — the timer origin for this attempt. */
  questionShownAt: number;
  current: Question;
  attempts: Attempt[];
  askedCount: number;
  /** Serialised RNG position, so the next draw continues the sequence. */
  draw: number;
  seed: string;
  templates: readonly QuestionTemplate[];
}

export interface SessionConfig {
  templates: readonly QuestionTemplate[];
  seed: string;
  startedAt: number;
  subject?: string;
  level?: YearLevel;
}

/** Each draw gets its own RNG seeded from (seed, draw index) so state stays serialisable. */
function drawQuestion(templates: readonly QuestionTemplate[], seed: string, draw: number): Question {
  const rng: Rng = createRng(`${seed}:${draw}`);
  const template = rng.pick(templates);
  return generateQuestion(template, rng);
}

export function startSession(config: SessionConfig): SessionState {
  if (config.templates.length === 0) {
    throw new Error('Cannot start a session with no question templates');
  }

  const first = drawQuestion(config.templates, config.seed, 0);

  return {
    subject: config.subject ?? first.subject,
    level: config.level ?? first.level,
    startedAt: config.startedAt,
    questionShownAt: config.startedAt,
    current: first,
    attempts: [],
    askedCount: 0,
    draw: 0,
    seed: config.seed,
    templates: config.templates,
  };
}

export function submitAnswer(state: SessionState, response: string, now: number): SessionState {
  const { correct, response: normalised } = gradeAnswer(state.current, response);

  const attempt: Attempt = {
    templateId: state.current.templateId,
    subject: state.current.subject,
    topic: state.current.topic,
    level: state.current.level,
    prompt: state.current.prompt,
    expected: String(state.current.answer),
    response: normalised,
    correct,
    timeTakenMs: Math.max(0, now - state.questionShownAt),
    answeredAt: now,
  };

  const draw = state.draw + 1;

  return {
    ...state,
    current: drawQuestion(state.templates, state.seed, draw),
    draw,
    questionShownAt: now,
    attempts: [...state.attempts, attempt],
    askedCount: state.askedCount + 1,
  };
}

export const elapsedMs = (state: SessionState, now: number): number =>
  Math.max(0, now - state.startedAt);

/** m:ss, counting up with no cap — sessions are open ended. */
export function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}
