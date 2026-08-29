/**
 * Where the time goes, written down.
 *
 * The web app is two network hops from its data now - browser to Vercel, Vercel
 * to Fly, Fly to Neon - and a third of that journey pays for a session lookup
 * twice over: `auth()` resolves the cookie against Neon here, and the API
 * resolves the very same cookie against the very same table on the far side.
 * None of that is visible from a stack trace, so it is measured instead.
 *
 * It sits here rather than in `src/lib` for the same reason `src/api.ts` does:
 * `src/lib` is the pure engine and may not touch the clock. `performance.now()`
 * is a clock.
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
