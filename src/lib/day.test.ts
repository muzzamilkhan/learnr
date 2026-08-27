import { describe, expect, it } from 'vitest';
import { localDay, parseOffsetMinutes, parsePlayedAt } from './day';

describe('localDay', () => {
  it('puts a Sydney evening on the day it was actually lived', () => {
    // 2024-05-01T22:00 in Sydney is 12:00 UTC on the same date.
    const at = Date.UTC(2024, 4, 1, 12, 0);
    expect(localDay(at, 600)).toBe(localDay(Date.UTC(2024, 4, 1, 0, 0)));
  });
});

describe('parseOffsetMinutes', () => {
  it('takes the offsets real devices report', () => {
    expect(parseOffsetMinutes(0)).toBe(0);
    expect(parseOffsetMinutes(600)).toBe(600);
    expect(parseOffsetMinutes(-720)).toBe(-720);
    // Chatham Islands, and the only reason the bound is not a whole hour.
    expect(parseOffsetMinutes(765)).toBe(765);
  });

  it('refuses an offset no clock could be at', () => {
    expect(parseOffsetMinutes(841)).toBeNull();
    expect(parseOffsetMinutes(-841)).toBeNull();
    // The shape that would otherwise be written to targetDay and lock it off.
    expect(parseOffsetMinutes(1e15)).toBeNull();
  });

  it('refuses anything that is not a whole number of minutes', () => {
    expect(parseOffsetMinutes(30.5)).toBeNull();
    expect(parseOffsetMinutes(NaN)).toBeNull();
    expect(parseOffsetMinutes('600')).toBeNull();
    expect(parseOffsetMinutes(null)).toBeNull();
    expect(parseOffsetMinutes(undefined)).toBeNull();
  });
});

describe('parsePlayedAt', () => {
  const NOW = Date.UTC(2026, 7, 28, 12, 0);

  it('takes a stamp from a run played earlier and flushed later', () => {
    const played = new Date(NOW - 9 * 60 * 60 * 1000).toISOString();
    expect(parsePlayedAt(played, NOW)?.toISOString()).toBe(played);
  });

  it('takes a zoned stamp, since a device sends its own offset', () => {
    expect(parsePlayedAt('2026-08-28T20:00:00+10:00', NOW)?.getTime()).toBe(Date.UTC(2026, 7, 28, 10, 0));
  });

  it('tolerates a clock a few minutes fast, which is ordinary skew', () => {
    const ahead = new Date(NOW + 60_000).toISOString();
    expect(parsePlayedAt(ahead, NOW)?.getTime()).toBe(NOW + 60_000);
  });

  // The asymmetry is the point: a stamp in the future sits at the top of every
  // ordering until real time reaches it, so the forward bound is tight.
  it('refuses a stamp further ahead than a clock could plausibly be', () => {
    expect(parsePlayedAt(new Date(NOW + 60 * 60 * 1000).toISOString(), NOW)).toBeNull();
    expect(parsePlayedAt('2099-01-01T00:00:00.000Z', NOW)).toBeNull();
  });

  it('refuses a stamp older than any offline queue could be holding', () => {
    expect(parsePlayedAt(new Date(NOW - 400 * 24 * 60 * 60 * 1000).toISOString(), NOW)).toBeNull();
    // The dead-battery clock, which would otherwise date a real run 1970.
    expect(parsePlayedAt('1970-01-01T00:00:00.000Z', NOW)).toBeNull();
  });

  it('refuses anything that is not a full timestamp', () => {
    expect(parsePlayedAt('2026', NOW)).toBeNull();
    expect(parsePlayedAt('2026-08-28', NOW)).toBeNull();
    expect(parsePlayedAt('not a date', NOW)).toBeNull();
    expect(parsePlayedAt(NOW, NOW)).toBeNull();
    expect(parsePlayedAt(null, NOW)).toBeNull();
    expect(parsePlayedAt(undefined, NOW)).toBeNull();
  });
});
