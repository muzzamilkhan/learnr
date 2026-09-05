import type { RandomInt } from './login-code';

/**
 * The code mailed to an address, and the grant it is exchanged for.
 *
 * Beside `login-code.ts` and pure for the same reasons: `now` and the randomness
 * are the caller's, and the caller must pass `crypto.randomInt` rather than the
 * seeded `Rng` - a code somebody can replay is not a code.
 *
 * **Two secrets, not one, and they are different shapes.** The code is six
 * digits because a grown-up reads it out of a mail client and types it into a
 * form, so it is short and the throttle is what makes it safe. The grant is what
 * the code buys - the right to set a password on the address just proved - and
 * nobody ever reads it, so it is long enough that guessing is not a strategy.
 */

export const VERIFICATION_CODE_CHARSET = '0123456789';
export const VERIFICATION_CODE_LENGTH = 6;

/** Long enough to find the mail, short enough that a forwarded one is stale. */
export const VERIFICATION_CODE_TTL_MS = 10 * 60 * 1000;

export const GRANT_CHARSET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
export const GRANT_LENGTH = 32;

/** The last screen is the next thing they do, so this is short on purpose. */
export const GRANT_TTL_MS = 10 * 60 * 1000;

/**
 * Wrong codes allowed per window, keyed by address *and* by browser.
 *
 * Six digits is a million codes, which single use and ten minutes do not cover
 * on their own. Keying by address is safe here where it is not on a password
 * sign-in: what it slows is an attempt to take over an address, and it locks
 * nobody out of an account they already hold - a parent with a password still
 * signs in, and a parent with Google still signs in.
 */
export const CODE_FAILURE_LIMIT = 5;
export const CODE_FAILURE_WINDOW_MS = 15 * 60 * 1000;

/** So the form cannot be used to mail somebody over and over. */
export const SEND_LIMIT = 5;
export const SEND_WINDOW_MS = 60 * 60 * 1000;

/**
 * Failed password sign-ins per browser, and **not** per address.
 *
 * Counting per account hands an attacker a way to lock a named parent out of
 * their own account, which is the objection CLAUDE.md already makes to a global
 * ceiling, narrowed to one person.
 */
export const PASSWORD_FAILURE_LIMIT = 10;
export const PASSWORD_FAILURE_WINDOW_MS = 15 * 60 * 1000;

/** What came of checking a code. Three answers, for `RedeemStatus`'s reason. */
export type VerifyStatus = 'verified' | 'rejected' | 'unavailable';

/** Only a rejection is somebody guessing. See `login-code.ts`'s `isGuess`. */
export function isGuess(status: VerifyStatus): boolean {
  return status === 'rejected';
}

function draw(charset: string, length: number, randomInt: RandomInt): string {
  let out = '';
  for (let i = 0; i < length; i += 1) out += charset[randomInt(charset.length)];
  return out;
}

export function generateVerificationCode(randomInt: RandomInt): string {
  return draw(VERIFICATION_CODE_CHARSET, VERIFICATION_CODE_LENGTH, randomInt);
}

export function generateGrantToken(randomInt: RandomInt): string {
  return draw(GRANT_CHARSET, GRANT_LENGTH, randomInt);
}

export function normaliseVerificationCode(input: string): string | null {
  const trimmed = input.trim();
  if (trimmed.length !== VERIFICATION_CODE_LENGTH) return null;
  for (const char of trimmed) {
    if (!VERIFICATION_CODE_CHARSET.includes(char)) return null;
  }
  return trimmed;
}

/** The longest an address may be, per RFC 5321. */
const MAX_EMAIL_LENGTH = 254;

/**
 * What was typed, as an address - or null if it could never be one.
 *
 * Case is folded, which is lossy in theory: the local part of an address is
 * case-sensitive to the letter of the specification and to no mail provider in
 * practice. It is folded because this string is the key two sign-in paths match
 * on, and `Ada@` failing to find the row `ada@` made would be the bug.
 *
 * The shape test is deliberately loose. An address is proved by mailing it, not
 * by a regular expression, and every regular expression that tries refuses
 * somebody's real address.
 */
export function normaliseEmail(input: string): string | null {
  const trimmed = input.trim().toLowerCase();
  if (trimmed.length === 0 || trimmed.length > MAX_EMAIL_LENGTH) return null;
  if (/\s/.test(trimmed)) return null;
  const parts = trimmed.split('@');
  if (parts.length !== 2) return null;
  const [local, domain] = parts;
  if (local.length === 0 || domain.length === 0) return null;
  if (!domain.includes('.')) return null;
  if (domain.startsWith('.') || domain.endsWith('.')) return null;
  return trimmed;
}

/**
 * Both kinds of row live in Auth.js's `VerificationToken` table, which has no
 * column saying which kind it is - so the prefix on `identifier` is what keeps a
 * code from being spendable as a grant.
 */
const CODE_PREFIX = 'password-code:';
const GRANT_PREFIX = 'password-grant:';

export function codeIdentifier(email: string): string {
  return `${CODE_PREFIX}${email}`;
}

export function grantIdentifier(email: string): string {
  return `${GRANT_PREFIX}${email}`;
}

export function emailFromIdentifier(identifier: string): string | null {
  if (identifier.startsWith(CODE_PREFIX)) return identifier.slice(CODE_PREFIX.length);
  if (identifier.startsWith(GRANT_PREFIX)) return identifier.slice(GRANT_PREFIX.length);
  return null;
}
