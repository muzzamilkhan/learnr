import { describe, expect, it } from 'vitest';
import { recordBanners } from './banner';
import type { ChildRecord } from '../speed-records';

function record(overrides: Partial<ChildRecord> = {}): ChildRecord {
  return {
    childId: 'child-1',
    childName: 'Shanaaya',
    mode: 'multiply.4',
    best: 20,
    achievedAt: new Date('2026-08-18T10:00:00Z'),
    ...overrides,
  };
}

describe('recordBanners', () => {
  it('names the child, the mode and the score, and says which game it was', () => {
    const [banner] = recordBanners([record()]);
    expect(banner.message).toBe(
      'Shanaaya scored a speed run personal best in the 4 times table: 20 questions!',
    );
  });

  it('describes every multiply variation as a table', () => {
    expect(recordBanners([record({ mode: 'multiply.all' })])[0].message).toContain(
      'all the tables',
    );
    expect(recordBanners([record({ mode: 'multiply.2-5' })])[0].message).toContain(
      'tables 2-5',
    );
  });

  it('names the difficulty and the operation for a non-multiply mode', () => {
    expect(recordBanners([record({ mode: 'subtract.hard' })])[0].message).toContain(
      'hard subtraction',
    );
  });

  it('keeps only the newest record per child', () => {
    const banners = recordBanners([
      record({ childId: 'a', mode: 'add.easy', achievedAt: new Date('2026-08-18T10:00:00Z') }),
      record({ childId: 'a', mode: 'subtract.hard', achievedAt: new Date('2026-08-17T10:00:00Z') }),
      record({ childId: 'b', mode: 'divide.moderate' }),
    ]);

    expect(banners).toHaveLength(2);
    expect(banners[0].message).toContain('easy addition');
    expect(banners[1].childId).toBe('b');
  });

  it('drops a record whose mode this build no longer recognises', () => {
    expect(recordBanners([record({ mode: 'not-a-real-mode' })])).toEqual([]);
  });

  it('returns nothing for no records', () => {
    expect(recordBanners([])).toEqual([]);
  });
});
