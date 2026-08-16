import { describe, it, expect } from 'vitest';
import {
  YEAR_LEVELS,
  isYearLevel,
  parseYearLevel,
  yearLabel,
  compareYearLevels,
  resolveInitialLevel,
} from './curriculum';

describe('YEAR_LEVELS', () => {
  it('covers Kindergarten through Year 6 in school order', () => {
    expect(YEAR_LEVELS).toEqual(['K', '1', '2', '3', '4', '5', '6']);
  });
});

describe('isYearLevel', () => {
  it('accepts the school years and nothing else', () => {
    expect(isYearLevel('K')).toBe(true);
    expect(isYearLevel('6')).toBe(true);
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
    expect(parseYearLevel('7')).toBeNull();
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
    expect(yearLabel('6')).toBe('Year 6');
  });
});

describe('compareYearLevels', () => {
  it('sorts K first and numbers numerically, not as text', () => {
    const shuffled = ['6', '2', 'K', '1', '4'] as const;
    expect([...shuffled].sort(compareYearLevels)).toEqual(['K', '1', '2', '4', '6']);
  });
});

describe('resolveInitialLevel', () => {
  const available = ['K', '1', '2'] as const;

  it('reopens the level the child last chose', () => {
    expect(resolveInitialLevel('2', [...available])).toBe('2');
  });

  it('normalises a stored level the way a URL is normalised', () => {
    expect(resolveInitialLevel('01', [...available])).toBe('1');
  });

  it('falls back to Kindergarten when nothing is stored', () => {
    expect(resolveInitialLevel(null, [...available])).toBe('K');
    expect(resolveInitialLevel('year 3', [...available])).toBe('K');
  });

  // Content is the source of truth, so a stored level whose templates have since
  // been removed must not leave the child on an empty screen.
  it('falls back when the stored level no longer has content', () => {
    expect(resolveInitialLevel('2', ['K', '1'])).toBe('K');
    expect(resolveInitialLevel('2', ['3', '4'])).toBe('3');
  });

  it('returns null when there is no content at all', () => {
    expect(resolveInitialLevel('K', [])).toBeNull();
  });
});
