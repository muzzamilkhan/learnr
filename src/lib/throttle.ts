/**
 * A fixed window of failures per caller, in memory.
 *
 * Pure in the sense the rest of `src/lib` is: `now` is passed in, nothing here
 * reads the clock, and a throttle owns only its own map - so a test can run a
 * window out in a line rather than waiting for one. `createThrottle` has four
 * callers in `src/app/actions.ts` now - `redeemLoginCodeAction` (a login
 * code), `sendPasswordCodeAction` (mail sent), `checkPasswordCodeAction` (a
 * six-digit code) and `signInWithPasswordAction` (a password) - each its own
 * instance with its own limit and window, all keyed off `browserIp`: the
 * thing a server action can see that a guess cannot fake by retrying.
 *
 * The window is fixed rather than sliding, counted from the first failure. A
 * sliding window is a list of timestamps per key where this is two numbers, and
 * the extra precision buys nothing against a guesser.
 *
 * **Only failures are counted, and a success wipes the slate.** A child
 * mistyping a code three times and then getting it right must not spend the
 * budget of the child after them, and a guesser has no success to clear with -
 * that is the thing they are trying to get.
 */

/**
 * How many callers are tracked at once.
 *
 * The key is an IP, and an attacker on IPv6 has a great many of those, so
 * without a cap this map is a memory leak with a remote write to it. Expiry is
 * what keeps it small in ordinary use - a sweep runs on every failure - and
 * this is the backstop for the case where it does not.
 */
export const MAX_TRACKED_KEYS = 10_000;

export type Throttle = {
  /** Whether this caller has spent its failures and must be refused. */
  blocked(key: string, now: number): boolean;
  /** Count a failure against this caller. */
  fail(key: string, now: number): void;
  /** Forget this caller's failures. What a success does. */
  clear(key: string): void;
  /** Whole seconds until the window frees up, for a `Retry-After`. Never zero. */
  retryAfterSeconds(key: string, now: number): number;
  /** How many callers are being tracked. */
  size(): number;
};

type Failures = { count: number; since: number };

export function createThrottle({
  limit,
  windowMs,
}: {
  limit: number;
  windowMs: number;
}): Throttle {
  const seen = new Map<string, Failures>();

  const live = (failures: Failures, now: number) => now - failures.since < windowMs;

  return {
    blocked(key, now) {
      const failures = seen.get(key);
      return failures !== undefined && live(failures, now) && failures.count >= limit;
    },

    fail(key, now) {
      for (const [seenKey, failures] of seen) {
        if (!live(failures, now)) seen.delete(seenKey);
      }

      const failures = seen.get(key);
      if (failures) {
        // Re-inserted rather than mutated in place, so the map's insertion
        // order is recency order and the eviction below takes the stalest
        // caller rather than whoever happened to arrive first.
        seen.delete(key);
        seen.set(key, { count: failures.count + 1, since: failures.since });
      } else {
        seen.set(key, { count: 1, since: now });
      }

      while (seen.size > MAX_TRACKED_KEYS) {
        const stalest = seen.keys().next().value;
        if (stalest === undefined) break;
        seen.delete(stalest);
      }
    },

    clear(key) {
      seen.delete(key);
    },

    retryAfterSeconds(key, now) {
      const failures = seen.get(key);
      if (!failures) return 0;
      return Math.max(1, Math.ceil((failures.since + windowMs - now) / 1000));
    },

    size() {
      return seen.size;
    },
  };
}

/**
 * The browser's address, out of the two headers a platform proxy sets.
 *
 * A boundary normaliser, beside `parseYearLevel` and `parseOffsetMinutes` in
 * spirit: what arrives is a header written by something else, and what comes
 * back is an address or null.
 *
 * `x-real-ip` is preferred because it is a single value with nothing to parse.
 * `x-forwarded-for` is a chain written client-first, so the client is the front
 * of it. On Vercel both are set by the platform for a server action, which is
 * the only caller that has any business reading them.
 *
 * **Null rather than a stand-in**, because every caller sharing one key would
 * turn a throttle into a lockout. What to do about an unattributable request is
 * the caller's decision, and it should be a deliberate one.
 */
export function browserIp(realIp: string | null, forwardedFor: string | null): string | null {
  const direct = realIp?.trim();
  if (direct) return direct;

  for (const hop of forwardedFor?.split(',') ?? []) {
    const address = hop.trim();
    if (address) return address;
  }

  return null;
}
