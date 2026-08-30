/**
 * The tap funnel: what happened to every finger that landed on a speed run,
 * and the arithmetic that turns a run's worth of them into something readable.
 *
 * **Why this exists.** A child reports that mid-run they cannot enter an answer
 * straight away and have to tap several times before anything is accepted.
 * Nothing on that path throws, nothing on it is a round trip, and the device it
 * happens on is an iPad with no console to open - so there is no log anywhere
 * that has ever seen it. That is the lesson the API collapse left written down
 * (`CLAUDE.md`, *what going cost*): a server log cannot see what the browser
 * did with a touch, and the instrumentation to reach for is browser-side.
 *
 * **A tap can die in four different places and each death is a different bug**,
 * which is why this records a funnel rather than a latency:
 *
 * | Between | Measured by | A gap means |
 * | --- | --- | --- |
 * | finger and `pointerdown` | the capture listener | nothing - this is the denominator |
 * | `pointerdown` and `click` | `clickMs` | **the browser ate it** |
 * | `click` and a verdict | `outcome` | **we refused it** |
 * | the verdict and the paint | `paintMs` | **the main thread was busy** |
 *
 * The fourth is worth spelling out, because it is the one that disguises itself
 * as the third. A tap that is accepted but does not repaint looks exactly like a
 * tap that was ignored, so the child taps again - and that extra digit is one
 * the entry cannot use, which kills it, flashes the box red and clears it. Jank
 * presents as refusal. Latency alone could never tell those two apart; the
 * funnel can.
 *
 * This half is pure and lives here for the usual reason: it is arithmetic over
 * records, it is the part worth having tests on, and `src/components/tap-probe.ts`
 * is the half that has to touch `PointerEvent`, `visualViewport` and the clock.
 *
 * **It is diagnostic and meant to be deleted**, along with the probe, the
 * overlay and the `?debug=` that turns them on. It is written to the same
 * standard as the rest of `src/lib` anyway, because instrumentation that is
 * itself wrong costs more than no instrumentation at all.
 */

/** Which phase of the run a tap landed in. A run refuses the pad outside `running`. */
export type TapPhase = 'countdown' | 'running' | 'result';

/**
 * What became of one tap.
 *
 * The three `refused-` values are the early returns in `press` given names, so
 * that "we decided not to act on this" is never confused with "this never
 * reached us". `swallowed` is the absence of all of them: a pointerdown that
 * never became a click, so no verdict was ever reached.
 */
export type TapOutcome =
  | 'correct'
  | 'dead'
  | 'typing'
  /** The entry was already at `MAX_NUMBER_LENGTH`, so the digit changed nothing. */
  | 'refused-full'
  /** The clock had run out between the tap and the handler. */
  | 'refused-over'
  /** There was no run to answer - the count-in, or the result screen. */
  | 'refused-none'
  /** No click ever arrived. Nothing of ours ran. */
  | 'swallowed';

const OUTCOMES: readonly TapOutcome[] = [
  'correct',
  'dead',
  'typing',
  'refused-full',
  'refused-over',
  'refused-none',
  'swallowed',
];

export interface TapRecord {
  /**
   * Milliseconds since the run's clock started. Negative during the count-in,
   * which is a real thing to be able to see rather than an error.
   */
  at: number;
  /** The pad key this landed on, or null for a tap that hit something else. */
  key: string | null;
  phase: TapPhase;
  /** `pointerdown` to `click`. Null when no click ever came - see `swallowed`. */
  clickMs: number | null;
  /** How long `press` itself ran for. */
  handlerMs: number | null;
  /** How much of `handlerMs` went on starting a sound. Null when none was played. */
  soundMs: number | null;
  /** `click` to the first paint after React had committed. */
  paintMs: number | null;
  outcome: TapOutcome;
  /** Whether the tap before this one hit the same key. */
  repeatKey: boolean;
  /** Milliseconds since the previous tap, or null for the first of a run. */
  sinceLastMs: number | null;
  /**
   * `visualViewport.scale` when the tap landed. 1 unless the iPad has zoomed -
   * which it is free to do, Safari having ignored `user-scalable=no` since
   * iOS 10, whatever `layout.tsx` asks for.
   */
  scale: number;
}

/**
 * How the run is sliced for the trend.
 *
 * Fifteen seconds gives six buckets over a run, which is few enough to read at a
 * glance on an overlay and many enough to show a run getting worse as it goes.
 * The symptom is *mid-run*, and a single figure over ninety seconds is the one
 * shape that cannot show that: a run that is fine for a minute and falls apart
 * afterwards averages out to merely mediocre.
 */
export const RUN_BUCKET_MS = 15_000;

/** How many taps are kept whole beside the percentiles. */
export const WORST_TAPS = 5;

/**
 * How many swallowed taps are kept whole.
 *
 * More than `WORST_TAPS`, because these arrive in bursts - one run dropped
 * eleven of its thirteen inside a single fifteen-second bucket - and what is
 * being characterised is the shape of the burst rather than one bad tap. The
 * earliest are the ones kept, since a burst is read from its start.
 */
export const DROPPED_TAPS = 8;

export interface Percentiles {
  /** Null rather than zero when nothing was measured - `[]` and null again. */
  p50: number | null;
  p95: number | null;
  max: number | null;
}

export interface TapBucket {
  /** Milliseconds into the run this bucket starts at. */
  from: number;
  taps: number;
  swallowed: number;
  paintMs: Percentiles;
}

export interface TapSummary {
  taps: number;
  /** Taps on a key that never became a click. The number this was all built for. */
  swallowed: number;
  /** Of those, the ones that repeated the previous key - the double-tap signature. */
  swallowedRepeats: number;
  /** Taps that hit no key at all, and so were never the pad's to answer. */
  offPad: number;
  outcomes: Record<TapOutcome, number>;
  clickMs: Percentiles;
  handlerMs: Percentiles;
  soundMs: Percentiles;
  paintMs: Percentiles;
  /** The largest the viewport ever got. Above 1 is the zoom gesture, caught. */
  maxScale: number;
  buckets: TapBucket[];
  /** The slowest few taps, whole, because a percentile cannot be read back. */
  worst: TapRecord[];
  /**
   * The swallowed taps, whole, earliest first.
   *
   * `worst` cannot carry them: it ranks on `paintMs`, and a tap that never
   * became a click never painted - so the taps most worth reading were the one
   * shape the summary threw away. What is wanted from them is `sinceLastMs`.
   * A **two-digit answer is two taps in quick succession and a one-digit answer
   * is one**, which is the reported shape of the bug, so whether a dropped tap
   * follows hard on the heels of another is the question these exist to answer.
   */
  dropped: TapRecord[];
}

/**
 * Nearest rank, on the values there are.
 *
 * Nearest rank rather than interpolation because these samples are small - a
 * run is a few dozen taps and a bucket is a handful - and an interpolated p95
 * over eight values is a number invented between two real ones. Here the
 * reported figure is always a tap that actually happened.
 */
function percentiles(values: number[]): Percentiles {
  if (values.length === 0) return { p50: null, p95: null, max: null };

  const sorted = [...values].sort((a, b) => a - b);
  const at = (share: number) =>
    sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil(share * sorted.length) - 1))] ?? null;

  return { p50: at(0.5), p95: at(0.95), max: sorted[sorted.length - 1] ?? null };
}

/** The measured values of one field, with the taps that never had one left out. */
function measured(records: readonly TapRecord[], pick: (record: TapRecord) => number | null) {
  return records.map(pick).filter((value): value is number => value !== null);
}

/**
 * A tap that landed on a key and never became a click.
 *
 * Decided here rather than by a timer in the probe: the probe fills `clickMs`
 * in when a click arrives, and anything still null once the run is over never
 * got one. That leaves no window to tune and no timer to fire late, and the
 * only tap it can misjudge is one still in flight as the run ends.
 */
function wasSwallowed(record: TapRecord): boolean {
  return record.key !== null && record.clickMs === null;
}

export function summariseTaps(records: readonly TapRecord[]): TapSummary {
  const outcomes = Object.fromEntries(OUTCOMES.map((name) => [name, 0])) as Record<
    TapOutcome,
    number
  >;
  for (const record of records) outcomes[record.outcome] += 1;

  const swallowed = records.filter(wasSwallowed);

  const bucketCount = Math.max(
    1,
    ...records.map((record) => Math.floor(Math.max(0, record.at) / RUN_BUCKET_MS) + 1),
  );
  const buckets: TapBucket[] = Array.from({ length: bucketCount }, (_, index) => {
    // A tap from the count-in is negative and belongs in the first bucket:
    // there is nothing to the left of the start of the run.
    const inside = records.filter(
      (record) => Math.floor(Math.max(0, record.at) / RUN_BUCKET_MS) === index,
    );

    return {
      from: index * RUN_BUCKET_MS,
      taps: inside.length,
      swallowed: inside.filter(wasSwallowed).length,
      paintMs: percentiles(measured(inside, (record) => record.paintMs)),
    };
  });

  return {
    taps: records.length,
    swallowed: swallowed.length,
    swallowedRepeats: swallowed.filter((record) => record.repeatKey).length,
    offPad: records.filter((record) => record.key === null).length,
    outcomes,
    clickMs: percentiles(measured(records, (record) => record.clickMs)),
    handlerMs: percentiles(measured(records, (record) => record.handlerMs)),
    soundMs: percentiles(measured(records, (record) => record.soundMs)),
    paintMs: percentiles(measured(records, (record) => record.paintMs)),
    maxScale: Math.max(1, ...records.map((record) => record.scale)),
    buckets,
    worst: [...records]
      .filter((record) => record.paintMs !== null)
      .sort((a, b) => (b.paintMs ?? 0) - (a.paintMs ?? 0))
      .slice(0, WORST_TAPS),
    dropped: swallowed.slice(0, DROPPED_TAPS),
  };
}

/**
 * The name of the cookie the flag persists in.
 *
 * **A query string could not survive the tap that starts a run.** A mode chip
 * links to `/speed/multiply.7` and nothing more - the run is the route, which
 * is the whole point of that shape - so `?debug=1` was lost the moment anybody
 * chose what to play. Hand-typing a run URL was the only way the overlay ever
 * appeared, which is no way to watch a child play twenty runs.
 *
 * A session cookie rather than a dated one: it should last as long as the
 * browser is open and no longer, and it is cleared on sign-out with everything
 * else that belongs to whoever was using the iPad. It is a diagnostic flag and
 * decides nothing but whether a readout is drawn, so it is not a boundary and
 * the client is free to write it.
 */
export const DEBUG_COOKIE = 'learnr-debug';

/** The one value the cookie is ever set to. Anything else is somebody else's. */
export const DEBUG_COOKIE_ON = '1';

/**
 * What a `?debug=` is asking for, if anything.
 *
 * **Three answers rather than two, and the third is what the cookie forced.**
 * Before the flag persisted, "no `?debug=`" and "`?debug=` off" were the same
 * thing, because leaving the query off *was* how you turned it off. A cookie
 * outlives the URL that set it, so a URL with no opinion must leave it alone
 * while a URL that says off must clear it - and those are now different
 * answers.
 *
 * **It still refuses rather than falling back**, which is the opposite of
 * `parseScoreTab` and for the opposite reason: a mistyped tab is a URL in front
 * of a screen that works, where a mistyped debug flag would put a diagnostic
 * overlay over a run somebody meant to play. So only the spellings that plainly
 * mean it are read, and everything else means nothing at all.
 */
export type DebugRequest = 'on' | 'off' | null;

export function parseDebugParam(value: string | undefined): DebugRequest {
  if (value === '1' || value === 'taps') return 'on';
  if (value === '0' || value === 'off') return 'off';
  return null;
}

/**
 * Whether to draw the readout: what the URL says, or failing that the cookie.
 *
 * The URL wins both ways round, so a run can always be turned back to normal
 * from the address bar without hunting for browser settings - which matters on
 * the one device where the flag is used and where clearing a cookie by hand is
 * several taps into a menu a child should not be in.
 */
export function debugEnabled(request: DebugRequest, cookie: string | undefined): boolean {
  if (request !== null) return request === 'on';
  return cookie === DEBUG_COOKIE_ON;
}
