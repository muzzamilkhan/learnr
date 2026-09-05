import { scrypt, timingSafeEqual } from 'node:crypto';

/**
 * A parent's password, hashed.
 *
 * Pure in the sense the rest of `src/lib` is - no clock, no network, no
 * database, and the randomness is passed in, exactly as `login-code.ts` takes
 * `crypto.randomInt` rather than reaching for it. scrypt itself is a
 * deterministic function of the password, the salt and the cost parameters, so
 * a test can pin all three and get the same bytes on every machine.
 *
 * `node:crypto` rather than a dependency: this repository has one UI dependency
 * and should not gain an auth one for a key derivation function that ships with
 * the runtime.
 */

/** `randomBytes(size)` must return `size` cryptographically random bytes. */
export type RandomBytes = (size: number) => Buffer;

/**
 * Long enough to be worth the scrypt cost in front of it, short enough that a
 * grown-up will actually choose one. Length is the only rule: composition rules
 * push people towards `Passw0rd!` and buy nothing.
 */
export const PASSWORD_MIN_LENGTH = 10;

/**
 * Not a security limit - a scrypt call is linear in the input it hashes, so an
 * unbounded password is a way to spend the server's CPU from a form.
 */
export const PASSWORD_MAX_LENGTH = 200;

/**
 * scrypt's cost. 128 * N * r bytes of memory, so this is 16MB - under node's
 * 32MB `maxmem` default, which is why nothing here has to raise it.
 */
export const SCRYPT_N = 16_384;
export const SCRYPT_R = 8;
export const SCRYPT_P = 1;
export const KEY_LENGTH = 32;
export const SALT_LENGTH = 16;

export type StoredHash = { N: number; r: number; p: number; salt: Buffer; key: Buffer };

const HEX = /^[0-9a-f]+$/;

function derive(password: string, salt: Buffer, N: number, r: number, p: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, KEY_LENGTH, { N, r, p }, (error, key) => {
      if (error) reject(error);
      else resolve(key);
    });
  });
}

/**
 * The parameters travel with the hash rather than being read from the constants
 * above. Raising the cost later must not strand every hash written before the
 * change: an old row still says what it was made with, and verifies.
 */
export async function hashPassword(password: string, randomBytes: RandomBytes): Promise<string> {
  const salt = randomBytes(SALT_LENGTH);
  const key = await derive(password, salt, SCRYPT_N, SCRYPT_R, SCRYPT_P);
  return [
    'scrypt',
    SCRYPT_N,
    SCRYPT_R,
    SCRYPT_P,
    salt.toString('hex'),
    key.toString('hex'),
  ].join('$');
}

/**
 * The boundary normaliser, beside `parsePhoto` and `parseYearLevel`: a stored
 * string is read back from a row and is not trusted to be one this code wrote.
 * Null means *there is no usable hash here*, which every caller reads as a
 * refused sign-in rather than an error.
 */
export function parseStoredHash(value: string | null | undefined): StoredHash | null {
  if (!value) return null;
  const parts = value.split('$');
  if (parts.length !== 6) return null;
  const [algorithm, rawN, rawR, rawP, salt, key] = parts;
  if (algorithm !== 'scrypt') return null;
  const N = Number(rawN);
  const r = Number(rawR);
  const p = Number(rawP);
  if (!Number.isInteger(N) || !Number.isInteger(r) || !Number.isInteger(p)) return null;
  if (N <= 1 || r < 1 || p < 1) return null;
  if (!HEX.test(salt) || !HEX.test(key)) return null;
  if (salt.length % 2 !== 0 || key.length % 2 !== 0) return null;
  return { N, r, p, salt: Buffer.from(salt, 'hex'), key: Buffer.from(key, 'hex') };
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parsed = parseStoredHash(stored);
  if (!parsed) return false;
  if (password.length > PASSWORD_MAX_LENGTH) return false;
  const key = await derive(password, parsed.salt, parsed.N, parsed.r, parsed.p);
  if (key.length !== parsed.key.length) return false;
  return timingSafeEqual(key, parsed.key);
}

/**
 * What was typed, as a password - or null if it could never be one. Unlike a
 * login code nothing is folded or trimmed: surrounding spaces are somebody's
 * password rather than their typing.
 */
export function parsePassword(value: string): string | null {
  if (value.length < PASSWORD_MIN_LENGTH) return null;
  if (value.length > PASSWORD_MAX_LENGTH) return null;
  return value;
}
