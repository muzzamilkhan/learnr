import { describe, expect, it } from 'vitest';
import { MAX_TIME_MS } from '../session/session';
import {
  TARGET_LIMITS,
  TARGET_STARS,
  dayTotal,
  parseTarget,
  targetCell,
  targetOptions,
  targetProgress,
  targetUnits,
  totalFor,
} from './target';

const DAY = 24 * 60 * 60 * 1000;
const MINUTE = 60 * 1000;
/** Midday on day `n` of the epoch, so no test sits on a boundary by accident. */
const at = (day: number, hour = 12) => day * DAY + hour * 60 * 60 * 1000;
const answer = (day: number, hour = 12, timeTakenMs = 30_000) => ({
  answeredAt: at(day, hour),
  timeTakenMs,
});

describe('parseTarget', () => {
  it('accepts a value on the step, inside its bounds', () => {
    expect(parseTarget('questions', 20)).toEqual({ kind: 'questions', value: 20 });
    expect(parseTarget('minutes', 5)).toEqual({ kind: 'minutes', value: 5 });
  });

  it('accepts a numeric string, which is what a form sends', () => {
    expect(parseTarget('minutes', '15')).toEqual({ kind: 'minutes', value: 15 });
  });

  it('refuses a kind that is not a target', () => {
    expect(parseTarget('none', 20)).toBeNull();
    expect(parseTarget(null, 20)).toBeNull();
    expect(parseTarget('hours', 3)).toBeNull();
  });

  it('refuses a value outside the bounds a parent may set', () => {
    expect(parseTarget('questions', 5)).toBeNull();
    expect(parseTarget('questions', 65)).toBeNull();
    expect(parseTarget('minutes', 0)).toBeNull();
    expect(parseTarget('minutes', 35)).toBeNull();
  });

  it('refuses a value between the steps, so one place normalises them', () => {
    expect(parseTarget('questions', 22)).toBeNull();
    expect(parseTarget('minutes', 7)).toBeNull();
  });

  it('refuses anything that is not a whole number', () => {
    expect(parseTarget('minutes', 12.5)).toBeNull();
    expect(parseTarget('minutes', 'soon')).toBeNull();
    expect(parseTarget('minutes', NaN)).toBeNull();
    expect(parseTarget('minutes', null)).toBeNull();
  });
});

describe('targetOptions', () => {
  it('runs from the floor to the ceiling on the step', () => {
    expect(targetOptions('minutes')).toEqual([5, 10, 15, 20, 25, 30]);
    expect(targetOptions('questions')).toEqual([10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60]);
  });

  it('offers only values parseTarget will take back', () => {
    for (const kind of ['questions', 'minutes'] as const) {
      for (const value of targetOptions(kind)) {
        expect(parseTarget(kind, value)).toEqual({ kind, value });
      }
    }
  });
});

describe('dayTotal', () => {
  it('counts only the answers given on the same day as now', () => {
    const answers = [answer(99), answer(100, 9), answer(100, 20), answer(101)];
    expect(dayTotal(answers, { now: at(100) })).toEqual({ questions: 2, timeMs: 60_000 });
  });

  it('is empty when nothing was answered today', () => {
    expect(dayTotal([answer(99)], { now: at(100) })).toEqual({ questions: 0, timeMs: 0 });
    expect(dayTotal([], { now: at(100) })).toEqual({ questions: 0, timeMs: 0 });
  });

  it('uses the child s local day, not the server s', () => {
    // 8pm UTC on day 100 is 6am on day 101 in Sydney, so a Sydney evening's
    // practice belongs to that evening and not to the next morning.
    const sydney = 10 * 60;
    const evening = [answer(100, 20), answer(100, 21)];
    expect(dayTotal(evening, { now: at(100, 21), offsetMinutes: sydney })).toEqual({
      questions: 2,
      timeMs: 60_000,
    });
    expect(dayTotal(evening, { now: at(100, 21) })).toEqual({ questions: 2, timeMs: 60_000 });
    // The next UTC morning is the same Sydney day, so those answers still count.
    expect(dayTotal(evening, { now: at(101, 8), offsetMinutes: sydney }).questions).toBe(2);
    expect(dayTotal(evening, { now: at(101, 8) }).questions).toBe(0);
  });
});

describe('targetProgress', () => {
  it('counts questions towards a questions target', () => {
    const progress = targetProgress({ kind: 'questions', value: 20 }, { questions: 5, timeMs: 0 });
    expect(progress).toEqual({ done: 5, target: 20, fraction: 0.25, complete: false });
  });

  it('sums milliseconds towards a minutes target', () => {
    const progress = targetProgress({ kind: 'minutes', value: 10 }, { questions: 8, timeMs: 5 * MINUTE });
    expect(progress).toEqual({ done: 5 * MINUTE, target: 10 * MINUTE, fraction: 0.5, complete: false });
  });

  it('completes on exactly the answer that reaches the target', () => {
    const target = { kind: 'questions', value: 10 } as const;
    expect(targetProgress(target, { questions: 9, timeMs: 0 }).complete).toBe(false);
    expect(targetProgress(target, { questions: 10, timeMs: 0 }).complete).toBe(true);
  });

  it('clamps the fraction at one, because the bar never shows more than full', () => {
    const progress = targetProgress({ kind: 'questions', value: 10 }, { questions: 40, timeMs: 0 });
    expect(progress.fraction).toBe(1);
    expect(progress.done).toBe(40);
    expect(progress.complete).toBe(true);
  });

  it('is nothing at all before the first answer', () => {
    expect(targetProgress({ kind: 'minutes', value: 5 }, { questions: 0, timeMs: 0 })).toEqual({
      done: 0,
      target: 5 * MINUTE,
      fraction: 0,
      complete: false,
    });
  });
});

/**
 * The cap is the session engine's, and it is the reason a minutes target cannot
 * be finished by walking away: an abandoned question is not a measurement, so it
 * contributes its capped time and no more.
 */
describe('targetProgress with an abandoned question', () => {
  it('cannot be finished by one question left open all afternoon', () => {
    const abandoned = dayTotal([{ answeredAt: at(100), timeTakenMs: MAX_TIME_MS }], { now: at(100) });
    const progress = targetProgress({ kind: 'minutes', value: 30 }, abandoned);
    expect(progress.done).toBe(MAX_TIME_MS);
    expect(progress.complete).toBe(false);
  });
});

describe('targetCell', () => {
  const target = { kind: 'questions', value: 20 } as const;

  it('is nothing when the day was not practised at all', () => {
    expect(targetCell({ questions: 0, timeMs: 0 }, target)).toEqual({ state: 'none', fraction: 0 });
  });

  it('is part done when the day fell short', () => {
    expect(targetCell({ questions: 10, timeMs: 0 }, target)).toEqual({ state: 'partial', fraction: 0.5 });
  });

  it('is met on the target and past it', () => {
    expect(targetCell({ questions: 20, timeMs: 0 }, target)).toEqual({ state: 'met', fraction: 1 });
    expect(targetCell({ questions: 60, timeMs: 0 }, target)).toEqual({ state: 'met', fraction: 1 });
  });

  it('is part done for a minutes target that was practised but not met', () => {
    const minutes = { kind: 'minutes', value: 10 } as const;
    expect(targetCell({ questions: 3, timeMs: 2 * MINUTE }, minutes)).toEqual({
      state: 'partial',
      fraction: 0.2,
    });
  });
});

describe('the numbers the feature is built on', () => {
  it('awards ten stars, worth more than any single round', () => {
    expect(TARGET_STARS).toBe(10);
  });

  it('lets a parent set an easy first target, and stops them setting an impossible one', () => {
    expect(TARGET_LIMITS.questions).toEqual({ min: 10, max: 60, step: 5 });
    expect(TARGET_LIMITS.minutes).toEqual({ min: 5, max: 30, step: 5 });
  });

  it('measures a target in the unit the day is counted in', () => {
    expect(targetUnits({ kind: 'questions', value: 20 })).toBe(20);
    expect(targetUnits({ kind: 'minutes', value: 20 })).toBe(20 * MINUTE);
    expect(totalFor({ questions: 4, timeMs: 90_000 }, 'questions')).toBe(4);
    expect(totalFor({ questions: 4, timeMs: 90_000 }, 'minutes')).toBe(90_000);
  });
});
