import { describe, it, expect } from 'vitest';
import {
  YEAR_LEVELS,
  isYearLevel,
  parseYearLevel,
  shortYearLabel,
  yearLabel,
  compareYearLevels,
  resolveInitialLevel,
  STAGES,
  stageForLevel,
  levelsForStage,
  stageLabel,
  compareSubjects,
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

describe('shortYearLabel', () => {
  it('says Kindergarten as a year, so every level is the same width', () => {
    expect(shortYearLabel('K')).toBe('Year K');
    expect(shortYearLabel('3')).toBe('Year 3');
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

describe('stageForLevel', () => {
  // NSW stages span two school years. The mapping is total, which is why a
  // stage is derived here rather than stored on a template where it could
  // drift from the level beside it.
  it('maps every school year onto its NSW stage', () => {
    expect(stageForLevel('K')).toBe('ES1');
    expect(stageForLevel('1')).toBe('S1');
    expect(stageForLevel('2')).toBe('S1');
    expect(stageForLevel('3')).toBe('S2');
    expect(stageForLevel('4')).toBe('S2');
    expect(stageForLevel('5')).toBe('S3');
    expect(stageForLevel('6')).toBe('S3');
  });

  it('covers every level with a stage', () => {
    for (const level of ['K', '1', '2', '3', '4', '5', '6'] as const) {
      expect(STAGES).toContain(stageForLevel(level));
    }
  });
});

describe('levelsForStage', () => {
  // The pairing the curriculum page teaches, and the one this app has got
  // wrong before: Stage 2 is Years 3 and 4, never Year 2.
  it('gives each stage the school years it spans', () => {
    expect(levelsForStage('ES1')).toEqual(['K']);
    expect(levelsForStage('S1')).toEqual(['1', '2']);
    expect(levelsForStage('S2')).toEqual(['3', '4']);
    expect(levelsForStage('S3')).toEqual(['5', '6']);
  });

  // The half that catches a mapping edited on one side only: read one way and
  // then the other, every level has to come back.
  it('round-trips: every level is listed by the stage it maps to', () => {
    for (const level of YEAR_LEVELS) {
      expect(levelsForStage(stageForLevel(level))).toContain(level);
    }
  });

  it('lists every level exactly once across the stages', () => {
    expect(STAGES.flatMap(levelsForStage)).toEqual([...YEAR_LEVELS]);
  });
});

describe('stageLabel', () => {
  it('names each stage the way NSW does', () => {
    expect(stageLabel('ES1')).toBe('Early Stage 1');
    expect(stageLabel('S1')).toBe('Stage 1');
    expect(stageLabel('S2')).toBe('Stage 2');
    expect(stageLabel('S3')).toBe('Stage 3');
  });
});

describe('compareSubjects', () => {
  it('puts maths first, since it is the subject a report opens on', () => {
    expect(['english', 'maths'].sort(compareSubjects)).toEqual(['maths', 'english']);
  });

  it('sorts a subject it has never heard of after the ones it has', () => {
    expect(['science', 'english', 'maths'].sort(compareSubjects)).toEqual([
      'maths',
      'english',
      'science',
    ]);
  });

  it('falls back to alphabetical among unknown subjects', () => {
    expect(['science', 'art'].sort(compareSubjects)).toEqual(['art', 'science']);
  });
});
