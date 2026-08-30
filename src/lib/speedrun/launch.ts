/**
 * How long it takes to get *into* a run, from the finger going down on a mode
 * chip to the run being on screen.
 *
 * **The tap funnel measures a run; this measures the way in.** They are
 * different problems with different causes: nothing inside a run is a round
 * trip, and everything about opening one is. A child tapping "7x" waits for a
 * server render of `/speed/[mode]` - which is `force-dynamic`, resolves the
 * session and reads the account - and only then does the count-in appear. That
 * wait was reported as "about a second before clicking a button does anything",
 * and Sentry's own navigation span had already put one at 1591ms.
 *
 * **Why the wait has to be measured from the tap and not from the navigation.**
 * A router transition starts when the click is handled, so a span that begins
 * there cannot see a click that was slow to arrive - and that is the one thing
 * this codebase now knows to look for. The mark is written on `pointerdown`,
 * which is as close to the finger as the browser gets.
 *
 * The mark has to survive a navigation, so it goes through `sessionStorage` and
 * comes back as somebody else's string - hence `parseLaunchMark`, a boundary
 * normaliser beside `parseYearLevel`, `parseTarget` and `parseMode`. It refuses
 * rather than repairs: a mark that cannot be read is a run with no measurement,
 * which is exactly what a run opened by a typed URL is anyway.
 *
 * Diagnostic, and deleted with the tap funnel.
 */

/** Where the mark is kept between the tap and the run. */
export const LAUNCH_KEY = 'learnr-launch';

/**
 * How old a mark may be and still describe this journey.
 *
 * `sessionStorage` outlives the navigation it was written for, so a tap that
 * never arrived anywhere - the child wandered off, came back, and opened a run
 * some other way - would be read as a wait of several minutes and would be by
 * far the largest number in every summary. A minute is longer than any real
 * journey, cold start included, and shorter than any abandonment.
 */
export const LAUNCH_STALE_MS = 60_000;

export interface LaunchMark {
  /** The mode key that was tapped, so a mark cannot be spent on another run. */
  mode: string;
  /** Epoch milliseconds, not `performance.now()`: a hard load resets that clock. */
  at: number;
}

export function parseLaunchMark(raw: string | null): LaunchMark | null {
  if (!raw) return null;

  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }

  if (typeof value !== 'object' || value === null) return null;

  // `Object.hasOwn` on the parsed object for the reason the expression language
  // uses it: this string came back out of the browser, and a key inherited from
  // a prototype is not a key somebody wrote.
  const mode = Object.hasOwn(value, 'mode') ? (value as { mode: unknown }).mode : undefined;
  const at = Object.hasOwn(value, 'at') ? (value as { at: unknown }).at : undefined;

  if (typeof mode !== 'string' || mode === '') return null;
  if (typeof at !== 'number' || !Number.isFinite(at)) return null;

  return { mode, at };
}

export interface LaunchMarks {
  /** What was read back out of session storage, if anything. */
  mark: LaunchMark | null;
  /** The mode that actually opened. */
  mode: string;
  /** Epoch milliseconds at which the run screen could draw. */
  readyAt: number;
  /** The request that fetched this screen, where the browser will say. */
  fetchMs: number | null;
  /** Whether this was a full page load rather than a tap from the cards. */
  hardLoad: boolean;
}

export interface LaunchTiming {
  /**
   * Finger down on the chip to the run on screen. **The only number a child
   * could have reported**, and the one everything else is a share of. Null when
   * the run was not arrived at by tapping a chip.
   */
  waitMs: number | null;
  /** Of the wait, the request. Known even when there was no tap to measure from. */
  fetchMs: number | null;
  /** Of the wait, everything that was not the request. */
  restMs: number | null;
  hardLoad: boolean;
}

export function launchTiming({ mark, mode, readyAt, fetchMs, hardLoad }: LaunchMarks): LaunchTiming {
  const waitMs = usableWait(mark, mode, readyAt);

  return {
    waitMs,
    fetchMs,
    // Only meaningful against a wait: the request on its own is not a share of
    // anything, and subtracting it from nothing would invent a number.
    restMs: waitMs === null || fetchMs === null ? null : waitMs - fetchMs,
    hardLoad,
  };
}

function usableWait(mark: LaunchMark | null, mode: string, readyAt: number): number | null {
  if (!mark || mark.mode !== mode) return null;

  const waited = readyAt - mark.at;
  // A negative wait is a clock that moved and a long one is a mark that
  // outlived its journey. Neither is a measurement, and both would be reported
  // as the worst number in the set.
  if (waited < 0 || waited > LAUNCH_STALE_MS) return null;

  return waited;
}
