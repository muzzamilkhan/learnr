/**
 * Which day a moment falls in, in the child's terms.
 *
 * Everything in this app that counts days - mastery on separate days, a play
 * streak, the report's buckets - has to agree on where a day starts, and it is
 * never the server's midnight. An evening's practice in Sydney is that evening,
 * not the next morning UTC, so the offset the answer was given at travels with
 * it and every day question is asked through here.
 */

import { ISO_TIMESTAMP } from './revive';

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

/**
 * Five minutes, which is ordinary clock skew rather than a claim about when a
 * run happened. A device a minute fast is every device.
 */
const SKEW_LIMIT_MS = 5 * 60_000;

/**
 * Thirty days, the far side of any offline queue worth believing. A plane, a
 * holiday with no wifi, a school camp - all of them drain inside a month, and
 * past that a clock is likelier to be wrong than a run is to be that old.
 */
const BACKDATE_LIMIT_MS = 30 * DAY_MS;

/**
 * The boundary normaliser for when a run was played, beside `parseOffsetMinutes`
 * and for the same reason: it is a fact about the child's device that the server
 * cannot work out for itself, and it is *stored*.
 *
 * A run belongs to when it was played rather than when it was received - a
 * child's afternoon of offline runs used to land in one minute that evening, in
 * whatever order the queue drained, and a parent reading "latest run" believes
 * they are being told when their child played. So the stamp travels with the
 * run.
 *
 * **The two bounds are deliberately not symmetric**, because the two mistakes
 * are not. A stamp too far in the past sorts itself to the bottom and harms
 * nothing but its own row. A stamp in the future sits at the *top* of every
 * ordering - the cabinet, the report table, the family board - and tie-breaks
 * the star to itself, and stays there until real time catches up. So forward is
 * bounded at clock skew and backward at a month.
 *
 * A refusal is not a refused run: the caller falls back to the server's clock,
 * which is exactly what happened before a stamp was sent at all. That is
 * `parseOffsetMinutes`'s rule again - history is worth more than a perfect
 * timestamp, so the run is kept and only its stamp is given up.
 */
export function parsePlayedAt(value: unknown, now: number): Date | null {
  if (typeof value !== 'string') return null;

  // The shape first, and strictly: `new Date` is far looser than the wire
  // format - "2026" and "2026-08-28" both parse, to midnight UTC, which is a
  // date this would otherwise take as the moment a run was played.
  if (!ISO_TIMESTAMP.test(value)) return null;

  const ms = new Date(value).getTime();
  if (Number.isNaN(ms)) return null;

  if (ms > now + SKEW_LIMIT_MS) return null;
  if (ms < now - BACKDATE_LIMIT_MS) return null;

  return new Date(ms);
}
