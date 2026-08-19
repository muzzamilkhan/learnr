import { describe, expect, it } from 'vitest';
import {
  answerRun,
  isOver,
  pulseFor,
  remainingMs,
  runResult,
  startRun,
  SPEED_RUN_MS,
  type RunState,
} from './run';
import type { Mode } from './modes';

const MODE: Mode = { op: 'multiply', tables: 7 };
const start = (mode: Mode = MODE, startedAt = 1000) => startRun({ mode, seed: 'test', startedAt });

/** Answer the current question correctly, at `now`. */
const right = (state: RunState, now: number) => answerRun(state, String(state.current.answer), now);
const wrong = (state: RunState, now: number) => answerRun(state, 'nonsense', now);

describe('starting a run', () => {
  it('has a question and the one after it from the very first frame', () => {
    const state = start();
    expect(state.current.prompt).toBeTruthy();
    expect(state.next.prompt).toBeTruthy();
    expect(state.correct).toBe(0);
    expect(state.answers).toEqual([]);
  });

  it('never puts the same question in both slots', () => {
    for (let i = 0; i < 50; i++) {
      const state = startRun({ mode: MODE, seed: `seed-${i}`, startedAt: 0 });
      expect(state.current.prompt).not.toBe(state.next.prompt);
    }
  });

  it('is deterministic from its seed', () => {
    const a = startRun({ mode: MODE, seed: 'same', startedAt: 0 });
    const b = startRun({ mode: MODE, seed: 'same', startedAt: 0 });
    expect(a.current.prompt).toBe(b.current.prompt);
    expect(a.next.prompt).toBe(b.next.prompt);
  });
});

describe('answering', () => {
  it('promotes the lookahead and draws a new one', () => {
    const state = start();
    const wasNext = state.next.prompt;
    const after = right(state, 2000);
    expect(after.current.prompt).toBe(wasNext);
    expect(after.next.prompt).toBeTruthy();
  });

  it('counts a right answer and keeps it', () => {
    const after = right(start(), 2000);
    expect(after.correct).toBe(1);
    expect(after.answers).toHaveLength(1);
    expect(after.answers[0].correct).toBe(true);
  });

  it('keeps a wrong answer with what it should have been', () => {
    const state = start();
    const expected = String(state.current.answer);
    const after = wrong(state, 2000);
    expect(after.correct).toBe(0);
    expect(after.answers[0]).toMatchObject({ correct: false, response: 'nonsense', expected });
    expect(after.answers[0].prompt).toBe(state.current.prompt);
  });

  it('leaves the state it was given alone', () => {
    const state = start();
    right(state, 2000);
    expect(state.answers).toHaveLength(0);
    expect(state.correct).toBe(0);
  });

  it('grades a numerically equal answer as right', () => {
    const state = start();
    const after = answerRun(state, ` 0${state.current.answer} `, 2000);
    expect(after.correct).toBe(1);
  });

  it('counts an empty answer as wrong rather than right', () => {
    const after = answerRun(start(), '', 2000);
    expect(after.correct).toBe(0);
    expect(after.answers).toHaveLength(1);
  });

  it('refuses an answer that lands after the clock runs out', () => {
    const state = start(MODE, 1000);
    const after = right(state, 1000 + SPEED_RUN_MS + 1);
    expect(after).toBe(state);
  });

  it('accepts one landing on the last millisecond', () => {
    const state = start(MODE, 1000);
    const after = right(state, 1000 + SPEED_RUN_MS);
    expect(after.correct).toBe(1);
  });
});

describe('the clock', () => {
  it('counts down and never goes below zero', () => {
    const state = start(MODE, 1000);
    expect(remainingMs(state, 1000)).toBe(SPEED_RUN_MS);
    expect(remainingMs(state, 1000 + 30_000)).toBe(SPEED_RUN_MS - 30_000);
    expect(remainingMs(state, 1000 + SPEED_RUN_MS * 2)).toBe(0);
    expect(isOver(state, 1000 + SPEED_RUN_MS + 1)).toBe(true);
    expect(isOver(state, 1000 + SPEED_RUN_MS)).toBe(false);
  });

  it('beats harder as it empties', () => {
    expect(pulseFor(90_000)).toBe('calm');
    expect(pulseFor(31_000)).toBe('calm');
    expect(pulseFor(30_000)).toBe('slow');
    expect(pulseFor(15_000)).toBe('fast');
    expect(pulseFor(5_000)).toBe('urgent');
    expect(pulseFor(0)).toBe('urgent');
  });
});

describe('the result', () => {
  it('reports what was right, what was answered, and what was missed', () => {
    let state = start();
    state = right(state, 2000);
    state = wrong(state, 3000);
    state = right(state, 4000);

    const result = runResult(state);
    expect(result).toMatchObject({ correct: 2, answered: 3 });
    expect(result.missed).toHaveLength(1);
    expect(result.missed[0].correct).toBe(false);
  });
});

describe('a mode with few distinct questions', () => {
  it('does not hang, and never repeats within the two on screen', () => {
    let state = startRun({ mode: { op: 'multiply', tables: 2 }, seed: 'small', startedAt: 0 });
    for (let i = 0; i < 200; i++) {
      expect(state.current.prompt).not.toBe(state.next.prompt);
      state = right(state, 1000 + i);
    }
    expect(state.correct).toBe(200);
  });
});
