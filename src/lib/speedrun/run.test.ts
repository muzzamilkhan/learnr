import { describe, expect, it } from 'vitest';
import {
  answerRun,
  isOver,
  judgeEntry,
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

describe('starting a run', () => {
  it('has a question and the one after it from the very first frame', () => {
    const state = start();
    expect(state.current.prompt).toBeTruthy();
    expect(state.next.prompt).toBeTruthy();
    expect(state.correct).toBe(0);
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

describe('judging what has been typed', () => {
  it('is still typing while it could yet become the answer', () => {
    const state = start();
    const expected = String(state.current.answer);
    expect(judgeEntry(state, '')).toBe('typing');
    expect(judgeEntry(state, expected.slice(0, 1))).toBe('typing');
  });

  it('is correct on an exact match', () => {
    const state = start();
    expect(judgeEntry(state, String(state.current.answer))).toBe('correct');
  });

  it('is dead the moment it cannot be the answer', () => {
    const state = start();
    const expected = String(state.current.answer);
    // A leading digit the answer does not start with can never become it.
    const wrongFirst = expected[0] === '9' ? '8' : '9';
    expect(judgeEntry(state, wrongFirst)).toBe('dead');
  });

  it('will not take a longer entry that happens to start with the answer', () => {
    const state = start();
    expect(judgeEntry(state, `${state.current.answer}0`)).toBe('dead');
  });

  it('will not take a leading zero, since nothing here waits to be checked', () => {
    const state = start();
    expect(judgeEntry(state, `0${state.current.answer}`)).toBe('dead');
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

  it('counts a right answer', () => {
    const after = right(start(), 2000);
    expect(after.correct).toBe(1);
  });

  it('only ever moves on a right answer', () => {
    const state = start();
    expect(answerRun(state, 'nonsense', 2000)).toBe(state);
    expect(answerRun(state, '', 2000)).toBe(state);
    expect(answerRun(state, ` ${state.current.answer}`, 2000)).toBe(state);
  });

  it('leaves the state it was given alone', () => {
    const state = start();
    right(state, 2000);
    expect(state.correct).toBe(0);
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
  it('is the mode and how many were got right', () => {
    let state = start();
    state = right(state, 2000);
    state = right(state, 3000);
    state = right(state, 4000);

    expect(runResult(state)).toEqual({ mode: MODE, correct: 3 });
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
