import { describe, expect, it } from 'vitest';
import {
  INVITE_TTL_MS,
  TOKEN_CHARSET,
  TOKEN_LENGTH,
  generateShareToken,
  inviteExpiry,
  isInviteLive,
  normaliseToken,
  sharePath,
  timeLeft,
} from './share-link';

/** A counting stand-in for `crypto.randomInt`, so the charset walk is checkable. */
function sequence(...values: number[]): (max: number) => number {
  let i = 0;
  return () => values[i++ % values.length];
}

const now = new Date('2026-08-19T10:00:00Z');

describe('generateShareToken', () => {
  it('draws TOKEN_LENGTH characters from the charset', () => {
    const token = generateShareToken(sequence(0));
    expect(token).toHaveLength(TOKEN_LENGTH);
    expect(token).toBe(TOKEN_CHARSET[0]!.repeat(TOKEN_LENGTH));
  });

  it('only ever uses charset characters', () => {
    let n = 0;
    for (let i = 0; i < 50; i += 1) {
      const token = generateShareToken(() => n++ % TOKEN_CHARSET.length);
      for (const char of token) expect(TOKEN_CHARSET).toContain(char);
    }
  });

  it('is long enough that a token cannot be guessed at', () => {
    // A login code is four characters because a child types it; this one is
    // pasted, so there is no reason for it to be anything but unguessable.
    expect(TOKEN_LENGTH).toBeGreaterThanOrEqual(24);
  });

  it('survives a trip through a URL untouched', () => {
    let n = 0;
    const token = generateShareToken(() => n++ % TOKEN_CHARSET.length);
    expect(encodeURIComponent(token)).toBe(token);
  });
});

describe('inviteExpiry', () => {
  it('is a week out, long enough to be opened after a weekend', () => {
    expect(inviteExpiry(now).getTime()).toBe(now.getTime() + INVITE_TTL_MS);
    expect(INVITE_TTL_MS).toBe(7 * 24 * 60 * 60 * 1000);
  });
});

describe('normaliseToken', () => {
  it('takes a token of the right shape', () => {
    const token = generateShareToken(sequence(1));
    expect(normaliseToken(token)).toBe(token);
    expect(normaliseToken(` ${token} `)).toBe(token);
  });

  it('refuses anything that could not be a token', () => {
    expect(normaliseToken('')).toBeNull();
    expect(normaliseToken('too-short')).toBeNull();
    expect(normaliseToken('!'.repeat(TOKEN_LENGTH))).toBeNull();
  });

  it('keeps case, unlike a login code', () => {
    // A child types a code, so case is their typing rather than their answer. A
    // token is pasted, and folding case here would throw away half its bits.
    const token = 'a'.repeat(TOKEN_LENGTH);
    expect(normaliseToken(token.toUpperCase())).not.toBe(normaliseToken(token));
  });
});

describe('isInviteLive', () => {
  const later = new Date(now.getTime() + 1000);

  it('is live before it expires and never after', () => {
    expect(isInviteLive(later, null, now)).toBe(true);
    expect(isInviteLive(now, null, now)).toBe(false);
    expect(isInviteLive(now, null, later)).toBe(false);
  });

  it('is spent once it has been accepted', () => {
    // One link, one viewer: accepting consumes it the way redeeming spends a
    // login code, so a forwarded link cannot let a second person in.
    expect(isInviteLive(later, now, now)).toBe(false);
  });
});

describe('timeLeft', () => {
  const inMs = (ms: number) => new Date(now.getTime() + ms);
  const hour = 60 * 60 * 1000;

  it('says days while there are days, then hours, then minutes', () => {
    expect(timeLeft(inMs(6 * 24 * hour + hour), now)).toBe('6 days');
    expect(timeLeft(inMs(25 * hour), now)).toBe('1 day');
    expect(timeLeft(inMs(5 * hour), now)).toBe('5 hours');
    expect(timeLeft(inMs(hour), now)).toBe('1 hour');
    expect(timeLeft(inMs(90_000), now)).toBe('1 minute');
  });

  it('rounds down, so it never promises time that is not there', () => {
    expect(timeLeft(inMs(2 * 24 * hour - 1), now)).toBe('1 day');
    expect(timeLeft(inMs(2 * hour - 1), now)).toBe('1 hour');
  });

  it('says so once there is nothing left', () => {
    expect(timeLeft(now, now)).toBe('expired');
    expect(timeLeft(inMs(-hour), now)).toBe('expired');
  });
});

describe('sharePath', () => {
  it('is where a link lands', () => {
    expect(sharePath('abc')).toBe('/share/abc');
  });
});
