/**
 * Which day a moment falls in, in the child's terms.
 *
 * Everything in this app that counts days - mastery on separate days, a play
 * streak, the report's buckets - has to agree on where a day starts, and it is
 * never the server's midnight. An evening's practice in Sydney is that evening,
 * not the next morning UTC, so the offset the answer was given at travels with
 * it and every day question is asked through here.
 */

export const DAY_MS = 24 * 60 * 60 * 1000;

/** A day number: whole days since the epoch, shifted into the caller's local time. */
export const localDay = (at: number, offsetMinutes = 0): number =>
  Math.floor((at + offsetMinutes * 60_000) / DAY_MS);

/**
 * Fourteen hours, the widest a real timezone is from UTC, taken symmetrically so
 * the bound is a day either way rather than a table of which offsets exist.
 */
const OFFSET_LIMIT = 14 * 60;

/**
 * The boundary normaliser for an offset, like `parseYearLevel` and `parseTarget`.
 *
 * An offset is the one part of a day question the server cannot work out for
 * itself, so it arrives from the browser - and a day number computed from it is
 * *stored*, on `User.playStreakDay` and on `User.targetDay`. Both are guarded by
 * comparing against the day being written, so one absurd value written once
 * would sit in the future and quietly refuse every real day after it. That is a
 * child's stars gone with nothing on any screen to say why, and no way back
 * without a database edit.
 *
 * So it is bounded here, in the one place, and callers decide what to do with a
 * refusal: the award declines to pay out, and a recorded answer falls back to
 * UTC rather than being thrown away - history is worth more than a perfect day.
 */
export function parseOffsetMinutes(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isInteger(value)) return null;
  return value < -OFFSET_LIMIT || value > OFFSET_LIMIT ? null : value;
}
