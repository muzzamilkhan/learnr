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

export interface RunState {
  mode: Mode;
  seed: string;
  startedAt: number;
  draw: number;
  current: GeneratedQuestion;
  /** The one shown dimmed above. State, not a render trick - the screen shows it. */
  next: GeneratedQuestion;
  correct: number;
}

export interface RunResult {
  mode: Mode;
  correct: number;
}

/**
 * What the digits typed so far amount to.
 *
 * `typing` is an entry that could still become the answer, `correct` is the
 * answer, and `dead` is one that cannot become it however many more keys are
 * pressed - a mistyped first digit, or a right answer with something after it.
 */
export type EntryVerdict = 'typing' | 'correct' | 'dead';

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

/**
 * Grade the entry as it is being typed, character by character, rather than
 * once it is submitted - there is nothing to submit with.
 *
 * The comparison is an exact string one on purpose, where the old Check key
 * graded numerically. Nothing here waits to be checked, so there is no later
 * moment at which `07` could be read as 7: the leading zero is a keystroke the
 * answer does not begin with, and it is dead the instant it lands. That is the
 * honest reading of a pad with no Check on it, and it is why the screen clears
 * a dead entry immediately - a child is never left holding one that could have
 * been accepted if only they had pressed something.
 */
export function judgeEntry(state: RunState, entry: string): EntryVerdict {
  const expected = String(state.current.answer);
  if (entry === expected) return 'correct';
  return expected.startsWith(entry) ? 'typing' : 'dead';
}

/**
 * A run moves on a right answer and on nothing else.
 *
 * There is no wrong answer to record here, so there is nothing to fold in for
 * one: an entry that is not the answer leaves the state exactly as it was, and
 * the question stays up until it is got right or the clock runs out. That makes
 * the score and the number of questions answered the same number, which is why
 * `RunResult` carries only the one.
 *
 * The guard is here rather than only on the screen so this stays the single
 * place the rule is written down - the screen judges an entry so it knows
 * whether to flash, never to decide whether the run advances.
 */
export function answerRun(state: RunState, response: string, now: number): RunState {
  if (isOver(state, now)) return state;
  if (judgeEntry(state, response) !== 'correct') return state;

  const draw = state.draw + 1;

  return {
    ...state,
    draw,
    current: state.next,
    next: drawQuestion(state.mode, state.seed, draw, state.next.prompt),
    correct: state.correct + 1,
  };
}

export function runResult(state: RunState): RunResult {
  return { mode: state.mode, correct: state.correct };
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
