import { randomBytes } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  PASSWORD_MIN_LENGTH,
  hashPassword,
  parsePassword,
  parseStoredHash,
  verifyPassword,
} from './password';

describe('hashPassword and verifyPassword', () => {
  it('verifies the password it was made from', async () => {
    const stored = await hashPassword('correct horse battery', randomBytes);
    expect(await verifyPassword('correct horse battery', stored)).toBe(true);
  });

  it('refuses a different password', async () => {
    const stored = await hashPassword('correct horse battery', randomBytes);
    expect(await verifyPassword('correct horse batteru', stored)).toBe(false);
  });

  // The salt is what stops one leaked hash answering for two accounts.
  it('gives two identical passwords different hashes', async () => {
    const a = await hashPassword('same password here', randomBytes);
    const b = await hashPassword('same password here', randomBytes);
    expect(a).not.toEqual(b);
  });

  // The parameters travel with the hash so they can be raised later without
  // stranding every hash written before the change.
  it('reads the cost parameters back off the stored string', async () => {
    const stored = await hashPassword('correct horse battery', randomBytes);
    const parsed = parseStoredHash(stored);
    expect(parsed).not.toBeNull();
    expect(stored.startsWith(`scrypt$${parsed?.N}$${parsed?.r}$${parsed?.p}$`)).toBe(true);
  });
});

describe('parseStoredHash', () => {
  it.each([
    ['null', null],
    ['empty', ''],
    ['not enough fields', 'scrypt$16384$8$1$abcd'],
    ['an algorithm it does not know', 'bcrypt$16384$8$1$abcd$abcd'],
    ['a cost that is not a number', 'scrypt$plenty$8$1$abcd$abcd'],
    ['salt that is not hex', 'scrypt$16384$8$1$zzzz$abcd'],
  ])('returns null for %s', (_label, value) => {
    expect(parseStoredHash(value)).toBeNull();
  });
});

// A hash that will not parse is a row nobody can sign in with, never an
// exception in front of somebody trying to.
describe('verifyPassword against an unreadable hash', () => {
  it('is false rather than throwing', async () => {
    expect(await verifyPassword('anything at all', 'not a hash')).toBe(false);
  });

  it('returns false for a parsed hash with invalid scrypt parameters', async () => {
    // N=3 is not a power of two, which Node's scrypt rejects synchronously.
    // This stored hash parses correctly but will fail when derive() is called.
    const storedWithInvalidN = 'scrypt$3$8$1$aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa$aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
    expect(await verifyPassword('correct horse battery', storedWithInvalidN)).toBe(false);
  });
});

describe('parsePassword', () => {
  it('accepts a password at the floor', () => {
    const password = 'x'.repeat(PASSWORD_MIN_LENGTH);
    expect(parsePassword(password)).toBe(password);
  });

  it('refuses one below the floor', () => {
    expect(parsePassword('x'.repeat(PASSWORD_MIN_LENGTH - 1))).toBeNull();
  });

  // Spaces at either end are somebody's password, not their typing - unlike a
  // login code, which is read off a screen and retyped.
  it('keeps surrounding spaces rather than trimming them', () => {
    const password = `  ${'x'.repeat(PASSWORD_MIN_LENGTH)}  `;
    expect(parsePassword(password)).toBe(password);
  });

  it('refuses one long enough to be a denial of service', () => {
    expect(parsePassword('x'.repeat(10_000))).toBeNull();
  });
});
