import { createRng, type Rng } from '../rng';
import { generate } from '../templates/generate';
import type { GeneratedQuestion } from '../templates/types';
import { specsFor, type Mode } from './modes';

/**
 * A speed run: ninety seconds, one mode, and how many were right.
 *
 * Pure like the rest of `lib` - `now` is passed in, and every transition returns
 * a new state. That is what lets the whole run be tested without a clock, and it
 * is why the guard against an answer landing after time is up lives here rather
 * than in a race between two effects on the screen.
 */

/**
 * Fixed, global, and never changes. A record is only comparable against itself,
 * so the one number a run is measured in has to be the same number forever.
 */
export const SPEED_RUN_MS = 90_000;

/**
 * The run-up. The first question is already on screen behind it, so the clock
 * starts on a question that has been read - without it the first seconds of
 * every run are spent orienting, which makes the score partly a measure of
 * reaction time.
 */
export const COUNTDOWN_MS = 3_000;

/** How many redraws to spend avoiding a repeat before taking what comes. */
const REDRAWS = 8;

export interface SpeedAnswer {
  prompt: string;
  expected: string;
  response: string;
  correct: boolean;
}

export interface RunState {
  mode: Mode;
  seed: string;
  startedAt: number;
  draw: number;
  current: GeneratedQuestion;
  /** The one shown dimmed above. State, not a render trick - the screen shows it. */
  next: GeneratedQuestion;
  answers: readonly SpeedAnswer[];
  correct: number;
}

export interface RunResult {
  mode: Mode;
  correct: number;
  answered: number;
  missed: readonly SpeedAnswer[];
}

export type Pulse = 'calm' | 'slow' | 'fast' | 'urgent';

export interface StartRunConfig {
  mode: Mode;
  seed: string;
  startedAt: number;
}

/**
 * Each draw gets its own RNG seeded from (seed, draw index), mirroring
 * `session.ts` - the seed alone fixes the whole sequence, so a run can be
 * replayed from it. A mode's specs are picked between with the same rng before
 * generating from whichever one is chosen.
 *
 * `avoid` is the prompt currently on screen in the other slot: a mode like
 * `multiply.2` has only twelve possible questions, so a few redraws are spent
 * trying not to repeat it, then whatever comes is taken - never a hang.
 */
function drawQuestion(mode: Mode, seed: string, draw: number, avoid: string | null): GeneratedQuestion {
  const specs = specsFor(mode);

  const draw1 = (attempt: number): GeneratedQuestion => {
    const rng: Rng = createRng(`${seed}:${draw}:${attempt}`);
    const spec = specs.length === 1 ? specs[0] : rng.pick(specs);
    return generate(spec, rng);
  };

  let question = draw1(0);
  for (let attempt = 1; attempt < REDRAWS && question.prompt === avoid; attempt++) {
    question = draw1(attempt);
  }
  return question;
}

export function startRun(config: StartRunConfig): RunState {
  const current = drawQuestion(config.mode, config.seed, 0, null);
  const next = drawQuestion(config.mode, config.seed, 1, current.prompt);

  return {
    mode: config.mode,
    seed: config.seed,
    startedAt: config.startedAt,
    draw: 1,
    current,
    next,
    answers: [],
    correct: 0,
  };
}

/** Milliseconds left, never below zero - the clock face never counts negative. */
export function remainingMs(state: RunState, now: number): number {
  return Math.max(0, state.startedAt + SPEED_RUN_MS - now);
}

/** An answer on the last millisecond still counts - see `answerRun`. */
export function isOver(state: RunState, now: number): boolean {
  return now > state.startedAt + SPEED_RUN_MS;
}

export function answerRun(state: RunState, response: string, now: number): RunState {
  if (isOver(state, now)) return state;

  const trimmed = response.trim();
  const expected = String(state.current.answer);
  const correct = trimmed !== '' && Number(trimmed) === state.current.answer;

  const answer: SpeedAnswer = {
    prompt: state.current.prompt,
    expected,
    response: trimmed,
    correct,
  };

  const draw = state.draw + 1;

  return {
    ...state,
    draw,
    current: state.next,
    next: drawQuestion(state.mode, state.seed, draw, state.next.prompt),
    answers: [...state.answers, answer],
    correct: state.correct + (correct ? 1 : 0),
  };
}

export function runResult(state: RunState): RunResult {
  return {
    mode: state.mode,
    correct: state.correct,
    answered: state.answers.length,
    missed: state.answers.filter((answer) => !answer.correct),
  };
}

/**
 * Steps at 30s, 15s and 5s remaining. Named states rather than a raw number so
 * the component can key a CSS class off it instead of re-deriving the thresholds
 * itself - and so the thresholds are the thing under test, not eyeballed later.
 */
export function pulseFor(remaining: number): Pulse {
  if (remaining > 30_000) return 'calm';
  if (remaining > 15_000) return 'slow';
  if (remaining > 5_000) return 'fast';
  return 'urgent';
}
