import { describe, expect, it } from 'vitest';
import { localDay, parseOffsetMinutes } from './day';

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
