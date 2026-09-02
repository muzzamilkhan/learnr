import { describe, expect, it } from 'vitest';
import { formatCount, formatDuration, nameList, ordinal } from './format';

describe('formatCount', () => {
  it('leaves a small count alone', () => {
    expect(formatCount(0)).toBe('0');
    expect(formatCount(999)).toBe('999');
  });

  it('groups thousands', () => {
    expect(formatCount(1000)).toBe('1,000');
    expect(formatCount(12_345)).toBe('12,345');
  });
});

describe('nameList', () => {
  it('reads as a sentence rather than a list', () => {
    expect(nameList(['Ada'])).toBe('Ada');
    expect(nameList(['Ada', 'Bo'])).toBe('Ada and Bo');
    expect(nameList(['Ada', 'Bo', 'Cy'])).toBe('Ada, Bo and Cy');
  });

  it('has nothing to say about nobody', () => {
    expect(nameList([])).toBe('');
  });
});

describe('ordinal', () => {
  it('says a place the way a child does', () => {
    expect([1, 2, 3, 4, 5].map(ordinal)).toEqual(['1st', '2nd', '3rd', '4th', '5th']);
  });

  it('gets the teens right, which is the whole reason for the plural rules', () => {
    expect([11, 12, 13, 21, 22, 23].map(ordinal)).toEqual([
      '11th',
      '12th',
      '13th',
      '21st',
      '22nd',
      '23rd',
    ]);
  });
});

describe('formatDuration', () => {
  it('says seconds for a sitting shorter than a minute', () => {
    expect(formatDuration(12_265)).toBe('12s');
    expect(formatDuration(40_000)).toBe('40s');
    expect(formatDuration(59_400)).toBe('59s');
  });

  it('never rounds a real measurement down to nothing', () => {
    expect(formatDuration(1)).toBe('1s');
    expect(formatDuration(400)).toBe('1s');
  });

  it('switches to minutes at a minute', () => {
    expect(formatDuration(60_000)).toBe('1 min');
    expect(formatDuration(90_000)).toBe('2 min');
    expect(formatDuration(20 * 60_000)).toBe('20 min');
  });

  it('does not round seconds up into a minute it did not reach', () => {
    expect(formatDuration(59_900)).toBe('59s');
  });
});
