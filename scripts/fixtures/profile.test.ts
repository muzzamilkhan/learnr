import { describe, expect, it } from 'vitest';
import { MIN_OBSERVATIONS } from '../../src/lib/analytics/profile';
import { profileSet, SCENARIOS } from './profile';

describe('SCENARIOS', () => {
  it('names each one once', () => {
    const names = SCENARIOS.map((s) => s.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('reaches each threshold rather than sampling at random', () => {
    const names = SCENARIOS.map((s) => s.name);
    for (const name of [
      'below-min-observations',
      'struggling',
      'developing',
      'secure',
      'long-run-strength',
      'days-across-offsets',
      'out-of-order-days',
    ]) {
      expect(names).toContain(name);
    }
  });

  it('stops short of MIN_OBSERVATIONS where it says it does', () => {
    const short = SCENARIOS.find((s) => s.name === 'below-min-observations')!;
    expect(short.observations.length).toBeLessThan(MIN_OBSERVATIONS);
  });

  it('accumulates strength over a few hundred observations', () => {
    expect(
      SCENARIOS.find((s) => s.name === 'long-run-strength')!.observations.length,
    ).toBeGreaterThanOrEqual(300);
  });
});

describe('profileSet', () => {
  it('groups by scenario and hashes', () => {
    const set = profileSet();
    expect(set.name).toBe('profile');
    expect([...set.groups.keys()].sort()).toEqual(SCENARIOS.map((s) => s.name).sort());
    for (const hash of set.groups.values()) expect(hash).toMatch(/^[0-9a-f]{12}$/);
  });

  it('is deterministic', () => {
    expect([...profileSet().groups]).toEqual([...profileSet().groups]);
  });

  it('distinguishes the day scenarios, which is the trap it exists for', () => {
    const groups = profileSet().groups;
    expect(groups.get('days-across-offsets')).not.toBe(groups.get('out-of-order-days'));
  });
});
