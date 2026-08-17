import { describe, expect, it } from 'vitest';
import { currentStreak, nextPlayStreak, noStreak, startedNewDay } from './streak';

const DAY = 24 * 60 * 60 * 1000;
/** Midday on day `n` of the epoch, so a test never sits on a boundary by accident. */
const at = (day: number, hour = 12) => day * DAY + hour * 60 * 60 * 1000;

describe('nextPlayStreak', () => {
  it('starts at one on the first ever answer', () => {
    expect(nextPlayStreak(undefined, at(100))).toEqual({ days: 1, lastDay: 100 });
    expect(nextPlayStreak(noStreak(), at(100))).toEqual({ days: 1, lastDay: 100 });
  });

  it('does not move again on the same day', () => {
    const first = nextPlayStreak(undefined, at(100, 8));
    expect(nextPlayStreak(first, at(100, 20))).toEqual(first);
  });

  it('adds a day when the child comes back the next day', () => {
    expect(nextPlayStreak({ days: 4, lastDay: 100 }, at(101))).toEqual({ days: 5, lastDay: 101 });
  });

  it('counts a day apart rather than a full 24 hours', () => {
    // Late one evening, early the next morning: 11 hours, but two days.
    expect(nextPlayStreak({ days: 2, lastDay: 100 }, at(101, 7))).toEqual({
      days: 3,
      lastDay: 101,
    });
  });

  it('starts over at one after a missed day', () => {
    expect(nextPlayStreak({ days: 9, lastDay: 100 }, at(102))).toEqual({ days: 1, lastDay: 102 });
  });

  it('uses the child s local day, not the server s', () => {
    // 8pm UTC on day 100 is 6am on day 101 in Sydney.
    const sydney = 10 * 60;
    expect(nextPlayStreak({ days: 1, lastDay: 100 }, at(100, 20), sydney)).toEqual({
      days: 2,
      lastDay: 101,
    });
  });

  it('ignores an answer that arrives from an earlier day', () => {
    const streak = { days: 3, lastDay: 100 };
    expect(nextPlayStreak(streak, at(99))).toEqual(streak);
  });
});

/**
 * A day number is whole days since the epoch, not a calendar date, so the end of
 * a month is not a special case — it cannot be. These are here because it is a
 * fair thing to doubt, and the cost of being wrong is a child's streak.
 */
describe('nextPlayStreak across calendar boundaries', () => {
  const midday = (iso: string) => Date.parse(`${iso}T12:00:00Z`);

  const kept = (before: string, after: string) => {
    const first = nextPlayStreak({ days: 6, lastDay: 0 }, midday(before));
    return nextPlayStreak(first, midday(after));
  };

  it.each([
    ['a short month ending', '2026-01-31', '2026-02-01'],
    ['a 30-day month ending', '2026-04-30', '2026-05-01'],
    ['February in a common year', '2026-02-28', '2026-03-01'],
    ['February in a leap year', '2028-02-29', '2028-03-01'],
    ['the leap day itself', '2028-02-28', '2028-02-29'],
    ['a year ending', '2026-12-31', '2027-01-01'],
  ])('carries the streak over %s', (_, before, after) => {
    expect(kept(before, after).days).toBe(2);
  });

  it('carries it over a daylight saving change', () => {
    // Sydney, 8pm on either side of DST starting: +10:00 becomes +11:00, and the
    // two evenings are still consecutive days to the child who lived them.
    const saturday = nextPlayStreak(undefined, Date.parse('2026-10-03T10:00:00Z'), 600);
    const sunday = nextPlayStreak(saturday, Date.parse('2026-10-04T09:00:00Z'), 660);
    expect(sunday.days).toBe(2);
  });
});

describe('startedNewDay', () => {
  it('is true only when the fold moved onto a new day', () => {
    const before = { days: 3, lastDay: 100 };
    expect(startedNewDay(before, nextPlayStreak(before, at(101)))).toBe(true);
    expect(startedNewDay(before, nextPlayStreak(before, at(100)))).toBe(false);
    expect(startedNewDay(undefined, nextPlayStreak(undefined, at(100)))).toBe(true);
  });
});

describe('currentStreak', () => {
  it('is zero with nothing behind it', () => {
    expect(currentStreak(noStreak(), at(100))).toBe(0);
  });

  it('shows the run while it is still alive', () => {
    expect(currentStreak({ days: 5, lastDay: 100 }, at(100))).toBe(5);
    // Played yesterday, not yet today: still theirs to keep.
    expect(currentStreak({ days: 5, lastDay: 100 }, at(101))).toBe(5);
  });

  it('is zero once a day has been missed', () => {
    expect(currentStreak({ days: 5, lastDay: 100 }, at(102))).toBe(0);
  });
});
