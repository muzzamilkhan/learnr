/**
 * The code a parent reads out so a child can sign in without a Google account.
 *
 * Pure, like the rest of `src/lib`: `now` and the source of randomness are passed
 * in. The randomness is injected for the usual testability reason, but note the
 * caller must pass `crypto.randomInt` and *not* the seeded `Rng` used for
 * questions - that determinism exists so a session can be replayed from its seed,
 * which is precisely the property a login code must not have.
 *
 * The short-lived thing here is the code, not the login it grants. A code is good
 * for an hour and is spent the moment it is redeemed; the session it creates then
 * stays valid. Being locked out of a maths app mid-term, needing to find a parent
 * to get back in, is the friction this feature exists to remove.
 */

/**
 * Four characters, no `0/O` and no `1/I/L`. A code is read off a parent's screen
 * and typed by a child, so the pairs that get confused in that handoff are simply
 * not in the alphabet.
 */
export const CODE_CHARSET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

/**
 * Short enough for a child to carry across the room. The window and single-use
 * redemption are what make it safe, not its length.
 */
export const CODE_LENGTH = 4;

/** Long enough to get a child set up, short enough that a stale code is useless. */
export const CODE_TTL_MS = 60 * 60 * 1000;

/**
 * How long a run of failed redemptions is remembered.
 *
 * The code is the credential and `POST /auth/redeem` is deliberately open, so
 * the guess space is the only thing between somebody trying codes and a child's
 * account - and it is smaller than it looks. `CODE_CHARSET` is 31 characters
 * and `CODE_LENGTH` is 4, which is 923,521 codes; `redeemLoginCode` matches
 * **any** live code rather than one child's, so a guesser is not attacking one
 * account but the pool of every code out at that moment; and what a hit buys is
 * a session that does not expire on a schedule.
 *
 * Lengthening the code would be the other lever and is not this one's to pull:
 * four characters is a product decision - short enough for a child to carry
 * across the room - and the window plus single-use redemption were always the
 * argument for why four was safe.
 */
export const REDEEM_FAILURE_WINDOW_MS = 15 * 60 * 1000;

/**
 * Failed redemptions allowed per browser, per window.
 *
 * The primary control, applied where the child's own IP is visible - which is
 * the web app's server action, since a request reaches the API from Vercel
 * rather than from the child. Ten is far more than a child mistyping a
 * four-character code needs and far less than a guesser wants.
 */
export const REDEEM_FAILURE_LIMIT = 10;

/**
 * Failed redemptions allowed per caller at the API, per window.
 *
 * The backstop, and generous on purpose: at the API one key is a real device
 * (iOS, which calls it directly) and another is *every* browser at once (the
 * web app, arriving from Vercel's egress). A number tight enough to matter for
 * the first would lock out the second, so this bounds a direct attacker and
 * leaves the per-browser work to `REDEEM_FAILURE_LIMIT`.
 *
 * A global ceiling across all callers was considered and rejected: it would
 * hand an attacker a way to lock every child in the service out of signing in,
 * which is a worse outcome than the guessing it would prevent.
 */
export const REDEEM_BACKSTOP_LIMIT = 120;

/**
 * `randomInt(max)` must return a whole number in `[0, max)` - the contract of
 * `crypto.randomInt`, which is what production passes.
 */
export type RandomInt = (max: number) => number;

export function generateLoginCode(randomInt: RandomInt): string {
  let code = '';
  for (let i = 0; i < CODE_LENGTH; i += 1) {
    code += CODE_CHARSET[randomInt(CODE_CHARSET.length)];
  }
  return code;
}

export function codeExpiry(now: Date): Date {
  return new Date(now.getTime() + CODE_TTL_MS);
}

/**
 * What the child typed, as a code - or null if it could never be one. Case and
 * surrounding space are the child's typing, not their answer, so they are
 * forgiven; a character outside the charset means they have misread something,
 * and there is no code it could match.
 */
export function normaliseCode(input: string): string | null {
  const trimmed = input.trim().toUpperCase();
  if (trimmed.length !== CODE_LENGTH) return null;
  for (const char of trimmed) {
    if (!CODE_CHARSET.includes(char)) return null;
  }
  return trimmed;
}

/**
 * Both stored fields are null once a code is spent or was never issued, so the
 * null checks are the single-use rule doing its work rather than defensiveness.
 */
/**
 * Whether the stored code is still worth showing. This is what decides between
 * "Show code" and "Get code" on the children screen: a code that is still live
 * can be revealed again, and revealing it must not issue a new one - a child may
 * be halfway through typing the old one.
 */
export function isCodeLive(
  storedCode: string | null,
  expiresAt: Date | null,
  now: Date,
): boolean {
  if (!storedCode || !expiresAt) return false;
  return now < expiresAt;
}

/**
 * How long a code has left, rounded down. Shown to a parent, who needs the gist
 * rather than the second - and rounding down never promises time that isn't there.
 */
export function minutesLeft(expiresAt: Date, now: Date): number {
  return Math.max(0, Math.floor((expiresAt.getTime() - now.getTime()) / 60_000));
}

export function isCodeValid(
  input: string,
  storedCode: string | null,
  expiresAt: Date | null,
  now: Date,
): boolean {
  if (!storedCode || !expiresAt) return false;
  if (now >= expiresAt) return false;
  return normaliseCode(input) === storedCode;
}
