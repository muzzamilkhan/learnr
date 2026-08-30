import { describe, expect, it } from 'vitest';
import {
  CODE_CHARSET,
  CODE_LENGTH,
  CODE_TTL_MS,
  codeExpiry,
  generateLoginCode,
  isCodeLive,
  isCodeValid,
  minutesLeft,
  isGuess,
  normaliseCode,
} from './login-code';

/** A counting stand-in for `crypto.randomInt`, so the charset walk is checkable. */
function sequence(...values: number[]): (max: number) => number {
  let i = 0;
  return () => values[i++ % values.length];
}

describe('generateLoginCode', () => {
  it('draws CODE_LENGTH characters from the charset', () => {
    const code = generateLoginCode(sequence(0, 1, 2, 3));
    expect(code).toBe('ABCD');
    expect(code).toHaveLength(CODE_LENGTH);
  });

  it('only ever uses charset characters', () => {
    let n = 0;
    for (let i = 0; i < 200; i += 1) {
      const code = generateLoginCode(() => n++ % CODE_CHARSET.length);
      for (const char of code) expect(CODE_CHARSET).toContain(char);
    }
  });

  it('leaves out characters a child could misread', () => {
    // 0/O and 1/I/L are the pairs that get read back wrong off a screen.
    for (const char of '01OIL') expect(CODE_CHARSET).not.toContain(char);
  });
});

describe('normaliseCode', () => {
  it('accepts what a child actually types', () => {
    expect(normaliseCode(' abcd ')).toBe('ABCD');
  });

  it('is null for anything that is not a whole code', () => {
    expect(normaliseCode('abc')).toBeNull();
    expect(normaliseCode('abcde')).toBeNull();
    expect(normaliseCode('ab!d')).toBeNull();
    // Excluded characters are not codes, however they were arrived at.
    expect(normaliseCode('abc0')).toBeNull();
  });
});

describe('codeExpiry', () => {
  it('is an hour after it was issued', () => {
    const now = new Date('2026-08-17T09:00:00Z');
    expect(codeExpiry(now)).toEqual(new Date(now.getTime() + CODE_TTL_MS));
  });
});

describe('isCodeValid', () => {
  const stored = 'ABCD';
  const expires = new Date('2026-08-17T10:00:00Z');
  const during = new Date('2026-08-17T09:59:00Z');
  const after = new Date('2026-08-17T10:00:01Z');

  it('matches a live code, however it was typed', () => {
    expect(isCodeValid('abcd', stored, expires, during)).toBe(true);
  });

  it('rejects a code past its expiry', () => {
    expect(isCodeValid('ABCD', stored, expires, after)).toBe(false);
  });

  it('rejects the wrong code', () => {
    expect(isCodeValid('ABCE', stored, expires, during)).toBe(false);
  });

  it('rejects when there is no code to match - a spent code is cleared, not kept', () => {
    expect(isCodeValid('ABCD', null, null, during)).toBe(false);
    expect(isCodeValid('ABCD', stored, null, during)).toBe(false);
  });
});

describe('isCodeLive', () => {
  const expires = new Date('2026-08-17T10:00:00Z');

  it('is true while a code has time left', () => {
    expect(isCodeLive('ABCD', expires, new Date('2026-08-17T09:59:00Z'))).toBe(true);
  });

  it('is false once it has run out', () => {
    expect(isCodeLive('ABCD', expires, new Date('2026-08-17T10:00:00Z'))).toBe(false);
  });

  it('is false when there is no code - spent and never issued look the same', () => {
    expect(isCodeLive(null, expires, new Date('2026-08-17T09:00:00Z'))).toBe(false);
    expect(isCodeLive('ABCD', null, new Date('2026-08-17T09:00:00Z'))).toBe(false);
  });
});

describe('minutesLeft', () => {
  const expires = new Date('2026-08-17T10:00:00Z');

  it('rounds down, because a parent only needs the gist', () => {
    expect(minutesLeft(expires, new Date('2026-08-17T09:00:30Z'))).toBe(59);
  });

  it('never goes negative', () => {
    expect(minutesLeft(expires, new Date('2026-08-17T11:00:00Z'))).toBe(0);
  });
});

describe('isGuess', () => {
  it('counts a rejected code, because that is somebody trying one', () => {
    expect(isGuess('rejected')).toBe(true);
  });

  it('does not count a database that could not answer', () => {
    // The throttle exists to protect children from a guesser. Letting an
    // outage spend their ten attempts would have it lock out the one person it
    // is for - and a guesser cannot cause outages, so nothing is given away.
    expect(isGuess('unavailable')).toBe(false);
  });

  it('does not count a success', () => {
    expect(isGuess('redeemed')).toBe(false);
  });
});
