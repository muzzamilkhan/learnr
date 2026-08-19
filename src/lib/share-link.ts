/**
 * The link a parent sends to another grown-up so they can watch a child's
 * progress.
 *
 * Pure, like the rest of `src/lib`: `now` and the source of randomness are passed
 * in. As with `login-code.ts`, the caller must pass `crypto.randomInt` and *not*
 * the seeded `Rng` - a replayable question sequence is the point of that RNG and
 * exactly the property an invite token must not have.
 *
 * The two links in this app are deliberately not the same thing. A login code is
 * four characters because a child reads it off one screen and types it into
 * another; this token is pasted into a message and opened by an adult, so nothing
 * about it needs to be short and it is sized to be unguessable instead. What they
 * share is the rule that matters: the *link* is short-lived and single-use, and
 * what it grants outlives it. A code buys a session that never expires; an invite
 * buys a standing grant that only the parent who issued it can take back.
 */

/**
 * URL-safe and unambiguous to a machine, which is the only thing that reads it.
 * No `-` or `_`: nothing here is hand-typed, so there is no case to fold and no
 * reason to spend characters on separators.
 */
export const TOKEN_CHARSET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

/** 32 characters of a 62-character alphabet - about 190 bits, which is plenty. */
export const TOKEN_LENGTH = 32;

/**
 * A week. An invite is sent by message to another adult and opened when they next
 * look at their phone, which is often not today - an hour, the window a login code
 * gets, would turn most invites into a second conversation.
 */
export const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * `randomInt(max)` must return a whole number in `[0, max)` - the contract of
 * `crypto.randomInt`, which is what production passes.
 */
export type RandomInt = (max: number) => number;

export function generateShareToken(randomInt: RandomInt): string {
  let token = '';
  for (let i = 0; i < TOKEN_LENGTH; i += 1) {
    token += TOKEN_CHARSET[randomInt(TOKEN_CHARSET.length)];
  }
  return token;
}

export function inviteExpiry(now: Date): Date {
  return new Date(now.getTime() + INVITE_TTL_MS);
}

/**
 * What arrived in the URL, as a token - or null if it could never be one. Space
 * around it is a paste rather than an answer and is forgiven; case is not, since
 * folding it would throw away half the token's bits.
 */
export function normaliseToken(input: string): string | null {
  const trimmed = input.trim();
  if (trimmed.length !== TOKEN_LENGTH) return null;
  for (const char of trimmed) {
    if (!TOKEN_CHARSET.includes(char)) return null;
  }
  return trimmed;
}

/**
 * Whether an invite can still be accepted. Both halves of "one link, one viewer"
 * live here: the week it lasts, and the acceptance that spends it. The database
 * enforces the same rule in the statement that accepts, because two taps arriving
 * together would both pass a check made up here.
 */
export function isInviteLive(expiresAt: Date, acceptedAt: Date | null, now: Date): boolean {
  if (acceptedAt) return false;
  return now < expiresAt;
}

/**
 * How long an invite has left, for the parent watching a link they have sent sit
 * unopened. Rounded down at every step, like `minutesLeft` on a login code, so it
 * never promises time that isn't there.
 */
export function timeLeft(expiresAt: Date, now: Date): string {
  const ms = expiresAt.getTime() - now.getTime();
  if (ms <= 0) return 'expired';

  const minutes = Math.floor(ms / 60_000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days >= 1) return plural(days, 'day');
  if (hours >= 1) return plural(hours, 'hour');
  return plural(Math.max(1, minutes), 'minute');
}

const plural = (count: number, noun: string): string =>
  `${count} ${noun}${count === 1 ? '' : 's'}`;

/** Where a link lands. One place, so the page and the copy button agree. */
export function sharePath(token: string): string {
  return `/share/${token}`;
}
