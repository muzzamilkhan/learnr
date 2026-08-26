import { describe, expect, it } from 'vitest';
import { MIN_OBSERVATIONS, nextSkill } from '../../src/lib/analytics/profile';
import { localDay } from '../../src/lib/day';
import { NAME_SEP } from './canonical';
import { canonicalSkill, profileSet, SCENARIOS } from './profile';

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

  it("'days-across-offsets' actually spans three local days, which is the trap it exists for", () => {
    // Two different inputs hash differently almost by construction, so
    // comparing digests against 'out-of-order-days' would pass an
    // implementation that ignores offsetMinutes entirely. The real claim is
    // that the offset decides the day: five observations, three of them at
    // the same UTC instant, land on three distinct local days.
    const scenario = SCENARIOS.find((s) => s.name === 'days-across-offsets')!;
    const days = new Set(
      scenario.observations.map((o) => localDay(o.answeredAt, o.offsetMinutes)),
    );
    expect(days.size).toBe(3);
  });
});

describe('an absent value', () => {
  it("writes `null`, because the form takes its text from which primitive is absent", () => {
    // `String(null)` and `String(undefined)` are different strings, so a port
    // holding an `Optional` cannot decide this from emptiness. `lastCorrectDay`
    // is the one field in the whole form that reaches it.
    const wrong = SCENARIOS.find((s) => s.name === 'struggling')!.observations[0];
    expect(nextSkill(undefined, { ...wrong, correct: false }).lastCorrectDay).toBeNull();
    expect(canonicalSkill(nextSkill(undefined, { ...wrong, correct: false }))).toContain(
      `lastCorrectDay${NAME_SEP}null`,
    );
  });
});
