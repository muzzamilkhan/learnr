/**
 * Where the time goes, written down.
 *
 * This went in to measure a hop that no longer exists - Vercel to Fly, with a
 * session lookup paid for on each side of it. What is left to measure is Vercel
 * to Neon: `auth()` resolves the cookie there before a signed-in page has read
 * anything at all, and none of that is visible from a stack trace.
 *
 * It sits here rather than in `src/lib` because `src/lib` is the pure engine and
 * may not touch the clock. `performance.now()` is a clock.
 *
 * Nothing here is server-only. The overlay behind `?timing=1` reads the same
 * `stopwatch` from the browser, where the wait that matters most - server
 * actions queueing behind one another - is the one no server log can see.
 */

/**
 * When this instance started. A module is loaded once per lambda instance, so a
 * small reading means a cold invocation - which is worth telling apart from a
 * slow one, because nothing about batching or parallelising touches it.
 */
const bootedAt = Date.now();

/** How long this instance has been up. See `bootedAt`. */
export const uptimeMs = (): number => Date.now() - bootedAt;

/** Start counting. The returned function says how long it has been. */
export function stopwatch(): () => number {
  const started = performance.now();
  return () => Math.round(performance.now() - started);
}

/**
 * One line, one measurement. `up=` rides on every one of them rather than being
 * logged separately, so any single line says whether the instance that wrote it
 * was cold - a correlation that would otherwise need two lines and a request id
 * to join them by.
 */
export function logTiming(label: string, ms: number, extra?: string): void {
  console.log(`[timing] ${label} ${ms}ms up=${uptimeMs()}ms${extra ? ` ${extra}` : ''}`);
}

/**
 * Time an await and log it, whatever happens to it.
 *
 * The failure path is logged rather than skipped because a hop that dies slowly
 * is exactly what this is looking for - a dead connection costs the full
 * timeout, and a `finally` is the only place that reading survives the throw.
 */
export async function timed<T>(label: string, run: () => Promise<T>): Promise<T> {
  const elapsed = stopwatch();
  try {
    return await run();
  } finally {
    logTiming(label, elapsed());
  }
}

/**
 * The measurements the browser is allowed to report, as a closed set.
 *
 * The sink writes a label straight into a log line, so a label carrying a
 * newline would forge lines of its own - and the endpoint is unauthenticated,
 * because making it read the session would cost the very Neon round trip the
 * answer path just stopped paying. An allowlist settles both at once: these are
 * the labels this app records, so anything else is not a reading that could
 * have come from it, and there is nothing to escape.
 */
export const CLIENT_LABELS = [
  'startRecording',
  'recordAttempt',
  'awardRound',
  'awardTarget',
  'submitRun',
] as const;

export type ClientLabel = (typeof CLIENT_LABELS)[number];

export interface ClientSample {
  label: ClientLabel;
  ms: number;
}

/** At most this many readings per request - one batch must not be a flood of lines. */
const MAX_BATCH = 50;

/** Ten minutes. Past this it is not a measurement of anything. */
const MAX_SAMPLE_MS = 600_000;

const isLabel = (value: unknown): value is ClientLabel =>
  CLIENT_LABELS.includes(value as ClientLabel);

/**
 * A batch of client readings, or nothing.
 *
 * Every field is the browser's word and this endpoint is open, so it is a
 * boundary normaliser in the same shape as `parseTarget` and `parseFigure`: a
 * bad sample is dropped rather than refused, so one malformed reading does not
 * cost the good ones beside it.
 */
export function parseSamples(body: unknown): ClientSample[] {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) return [];

  const { samples } = body as { samples?: unknown };
  if (!Array.isArray(samples)) return [];

  return samples
    .filter((sample): sample is ClientSample => {
      if (typeof sample !== 'object' || sample === null) return false;
      const { label, ms } = sample as { label?: unknown; ms?: unknown };
      return (
        isLabel(label) &&
        typeof ms === 'number' &&
        Number.isFinite(ms) &&
        ms >= 0 &&
        ms <= MAX_SAMPLE_MS
      );
    })
    .slice(0, MAX_BATCH)
    .map(({ label, ms }) => ({ label, ms: Math.round(ms) }));
}
