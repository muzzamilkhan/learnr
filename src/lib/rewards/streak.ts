import { localDay } from '../day';

/**
 * The play streak: how many days in a row the child has answered something.
 *
 * Deliberately counted in *days*, not in hours since the last answer. An hours
 * rule punishes the ordinary case - practice after school one day and before
 * school the next is twenty hours apart, and would break a streak the child
 * kept perfectly well. Days are also the unit the child understands, and the
 * unit mastery is already counted in, so there is one idea of a day in the app.
 *
 * Days are the child's: the offset the answer was given at comes in with it, so
 * an evening in Sydney is that evening. Pure, like everything in `lib`.
 */

export interface PlayStreak {
  /** Consecutive local days with at least one answer on them. */
  days: number;
  /** The last day counted, so the fold can tell a new day from the same one again. */
  lastDay: number | null;
}

export const noStreak = (): PlayStreak => ({ days: 0, lastDay: null });

/**
 * One answer folded into the streak. Called on every answer and only moves on
 * the first of a day, which is what makes it cheap to write and safe to repeat.
 *
 * A missed day restarts at one rather than zero: the child is answering a
 * question right now, and today is a day. Zero would show them nothing for
 * having come back, which is the moment a streak is meant to reward most.
 *
 * An answer from a day already behind us leaves the streak alone - writes that
 * land out of order can only undercount, never invent a day, the same rule
 * `correctDays` follows.
 */
export function nextPlayStreak(
  previous: PlayStreak | undefined,
  at: number,
  offsetMinutes = 0,
): PlayStreak {
  const day = localDay(at, offsetMinutes);

  if (!previous || previous.lastDay === null) return { days: 1, lastDay: day };
  if (day <= previous.lastDay) return previous;

  return day === previous.lastDay + 1
    ? { days: previous.days + 1, lastDay: day }
    : { days: 1, lastDay: day };
}

/** Whether that fold was the first answer of a new day - the cue to celebrate it. */
export const startedNewDay = (previous: PlayStreak | undefined, next: PlayStreak): boolean =>
  previous?.lastDay !== next.lastDay;

/**
 * The streak as it stands *now*, which is not always the number that was stored.
 * A streak of five last played a week ago is over; showing it would be a lie the
 * child can check. Yesterday still counts - the day is not finished with, and
 * the run is theirs to keep by playing today.
 */
export function currentStreak(streak: PlayStreak, now: number, offsetMinutes = 0): number {
  if (streak.lastDay === null) return 0;
  const today = localDay(now, offsetMinutes);
  return today - streak.lastDay <= 1 ? streak.days : 0;
}
