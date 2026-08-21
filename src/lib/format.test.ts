import { describe, expect, it } from 'vitest';
import { formatCount, nameList, ordinal } from './format';

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
