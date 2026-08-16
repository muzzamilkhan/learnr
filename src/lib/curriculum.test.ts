import { describe, it, expect } from 'vitest';
import {
  YEAR_LEVELS,
  isYearLevel,
  parseYearLevel,
  yearLabel,
  compareYearLevels,
} from './curriculum';

describe('YEAR_LEVELS', () => {
  it('covers Kindergarten through Year 12 in school order', () => {
    expect(YEAR_LEVELS).toEqual(['K', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12']);
  });
});

describe('isYearLevel', () => {
  it('accepts the school years and nothing else', () => {
    expect(isYearLevel('K')).toBe(true);
    expect(isYearLevel('12')).toBe(true);
    expect(isYearLevel('13')).toBe(false);
    expect(isYearLevel('0')).toBe(false);
    expect(isYearLevel(1)).toBe(false);
    expect(isYearLevel(null)).toBe(false);
    expect(isYearLevel('')).toBe(false);
  });
});

describe('parseYearLevel', () => {
  it('normalises what arrives in a URL', () => {
    expect(parseYearLevel('k')).toBe('K');
    expect(parseYearLevel(' K ')).toBe('K');
    expect(parseYearLevel('3')).toBe('3');
    expect(parseYearLevel('03')).toBe('3');
  });

  it('returns null for anything that is not a school year', () => {
    expect(parseYearLevel('13')).toBeNull();
    expect(parseYearLevel('year 3')).toBeNull();
    expect(parseYearLevel(undefined)).toBeNull();
    expect(parseYearLevel('')).toBeNull();
  });
});

describe('yearLabel', () => {
  it('names each year the way a child would hear it', () => {
    expect(yearLabel('K')).toBe('Kindergarten');
    expect(yearLabel('1')).toBe('Year 1');
    expect(yearLabel('12')).toBe('Year 12');
  });
});

describe('compareYearLevels', () => {
  it('sorts K first and numbers numerically, not as text', () => {
    const shuffled = ['10', '2', 'K', '1', '12'] as const;
    expect([...shuffled].sort(compareYearLevels)).toEqual(['K', '1', '2', '10', '12']);
  });
});
