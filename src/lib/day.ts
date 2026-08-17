/**
 * Which day a moment falls in, in the child's terms.
 *
 * Everything in this app that counts days — mastery on separate days, a play
 * streak, the report's buckets — has to agree on where a day starts, and it is
 * never the server's midnight. An evening's practice in Sydney is that evening,
 * not the next morning UTC, so the offset the answer was given at travels with
 * it and every day question is asked through here.
 */

export const DAY_MS = 24 * 60 * 60 * 1000;

/** A day number: whole days since the epoch, shifted into the caller's local time. */
export const localDay = (at: number, offsetMinutes = 0): number =>
  Math.floor((at + offsetMinutes * 60_000) / DAY_MS);
