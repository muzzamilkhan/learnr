import { describe, expect, it } from 'vitest';
import type { AttemptResult, SpeedOutcome } from '@/lib/dto';

/**
 * `reviveDates` is gone from this path, so a `Date` in either shape would
 * arrive as a string and every caller would be quietly wrong. Both shapes are
 * numbers and booleans today - this fails the build the moment one is not.
 */
type NoDates<T> = T extends Date
  ? never
  : T extends object
    ? { [K in keyof T]: NoDates<T[K]> }
    : T;

type Checked<T> = NoDates<T> extends never ? never : T;

// A compile error here is the test failing.
type _Attempt = Checked<AttemptResult>;
type _Speed = Checked<SpeedOutcome>;

describe('browser-api response shapes', () => {
  it('carries no Date, because nothing revives one any more', () => {
    const attempt: _Attempt = { streak: 1, streakAdvanced: true };
    const speed: _Speed = { previousBest: null, best: 3, isRecord: true, standing: null };
    expect(attempt.streak).toBe(1);
    expect(speed.best).toBe(3);
  });
});
