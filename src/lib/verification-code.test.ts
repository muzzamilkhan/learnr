import { describe, expect, it } from 'vitest';
import {
  GRANT_LENGTH,
  VERIFICATION_CODE_LENGTH,
  codeIdentifier,
  emailFromIdentifier,
  generateGrantToken,
  generateVerificationCode,
  grantIdentifier,
  isGuess,
  normaliseEmail,
  normaliseVerificationCode,
} from './verification-code';

// A counting stand-in for crypto.randomInt: whole numbers in [0, max).
const counter = (start = 0) => {
  let n = start;
  return (max: number) => (n++) % max;
};

describe('generateVerificationCode', () => {
  it('is digits, at the declared length', () => {
    const code = generateVerificationCode(counter());
    expect(code).toHaveLength(VERIFICATION_CODE_LENGTH);
    expect(code).toMatch(/^[0-9]+$/);
  });
});

describe('generateGrantToken', () => {
  it('is at the declared length', () => {
    expect(generateGrantToken(counter())).toHaveLength(GRANT_LENGTH);
  });

  // Not the seeded Rng, and long enough that guessing one is not a strategy.
  it('is far longer than the code it is exchanged for', () => {
    expect(GRANT_LENGTH).toBeGreaterThan(VERIFICATION_CODE_LENGTH * 4);
  });
});

describe('normaliseVerificationCode', () => {
  it('forgives surrounding space', () => {
    expect(normaliseVerificationCode('  123456  ')).toBe('123456');
  });

  it.each([
    ['too short', '12345'],
    ['too long', '1234567'],
    ['letters', '12345a'],
    ['empty', ''],
  ])('refuses %s', (_label, input) => {
    expect(normaliseVerificationCode(input)).toBeNull();
  });
});

describe('normaliseEmail', () => {
  it('folds case and surrounding space', () => {
    expect(normaliseEmail('  Ada@Example.COM ')).toBe('ada@example.com');
  });

  it.each([
    ['no at sign', 'ada.example.com'],
    ['two at signs', 'ada@example@com'],
    ['no local part', '@example.com'],
    ['no domain', 'ada@'],
    ['a domain with no dot', 'ada@example'],
    ['internal space', 'ada bell@example.com'],
    ['empty', ''],
  ])('refuses %s', (_label, input) => {
    expect(normaliseEmail(input)).toBeNull();
  });

  it('refuses one longer than an address may be', () => {
    expect(normaliseEmail(`${'a'.repeat(250)}@example.com`)).toBeNull();
  });
});

// The two kinds of row share one table, so the prefix is what keeps a code from
// being spent as a grant.
describe('the identifiers', () => {
  it('round-trips an address through a code identifier', () => {
    expect(emailFromIdentifier(codeIdentifier('ada@example.com'))).toBe('ada@example.com');
  });

  it('round-trips an address through a grant identifier', () => {
    expect(emailFromIdentifier(grantIdentifier('ada@example.com'))).toBe('ada@example.com');
  });

  it('keeps the two apart', () => {
    expect(codeIdentifier('ada@example.com')).not.toBe(grantIdentifier('ada@example.com'));
  });

  it('returns null for an identifier of neither kind', () => {
    expect(emailFromIdentifier('ada@example.com')).toBeNull();
  });
});

describe('isGuess', () => {
  it('counts a rejection', () => {
    expect(isGuess('rejected')).toBe(true);
  });

  // The whole reason the status has three answers: an outage must not spend
  // somebody's attempts and then lock them out on top of it.
  it('does not count a database that could not answer', () => {
    expect(isGuess('unavailable')).toBe(false);
  });

  it('does not count a success', () => {
    expect(isGuess('verified')).toBe(false);
  });
});
