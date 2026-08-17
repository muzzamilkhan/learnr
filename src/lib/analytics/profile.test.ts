import { describe, it, expect } from 'vitest';

import {
  MIN_OBSERVATIONS,
  accuracy,
  applyObservation,
  averageTimeMs,
  buildProfile,
  emptyProfile,
  findSkill,
  hasPattern,
  recentTopics,
  reviewDueAt,
  skillStatus,
  type Observation,
} from './profile';

const DAY = 24 * 60 * 60 * 1000;

/** A run of answers on one topic, a minute apart, starting at `from`. */
function answers(
  topic: string,
  results: boolean[],
  { from = 0, timeTakenMs = 5000 }: { from?: number; timeTakenMs?: number } = {},
): Observation[] {
  return results.map((correct, index) => ({
    topic,
    level: 'K' as const,
    correct,
    timeTakenMs,
    answeredAt: from + index * 60_000,
  }));
}

const rights = (n: number) => Array(n).fill(true);
const wrongs = (n: number) => Array(n).fill(false);

describe('building a profile', () => {
  it('starts with nothing known', () => {
    expect(emptyProfile().skills).toEqual([]);
    expect(hasPattern(emptyProfile())).toBe(false);
  });

  it('keeps one skill per topic and level', () => {
    const profile = buildProfile([
      ...answers('counting', [true, false]),
      { topic: 'counting', level: '1', correct: true, timeTakenMs: 1000, answeredAt: 5 },
    ]);

    expect(profile.skills).toHaveLength(2);
    expect(findSkill(profile, 'counting', 'K')?.attempts).toBe(2);
    expect(findSkill(profile, 'counting', '1')?.attempts).toBe(1);
  });

  it('counts answers, time and the current run', () => {
    const profile = buildProfile(answers('counting', [true, true, false, true], { timeTakenMs: 4000 }));
    const skill = findSkill(profile, 'counting', 'K')!;

    expect(skill.attempts).toBe(4);
    expect(skill.correct).toBe(3);
    expect(accuracy(skill)).toBe(0.75);
    expect(averageTimeMs(skill)).toBe(4000);
    expect(skill.streak).toBe(1);
    expect(skill.lastAnsweredAt).toBe(3 * 60_000);
  });

  it('folds history in time order however it arrives', () => {
    const history = answers('counting', [false, false, true, true, true]);
    const forwards = buildProfile(history);
    const backwards = buildProfile([...history].reverse());

    expect(backwards).toEqual(forwards);
  });

  it('does not mutate the profile it is given', () => {
    const before = buildProfile(answers('counting', [true]));
    const snapshot = structuredClone(before);

    applyObservation(before, answers('counting', [false], { from: DAY })[0]);

    expect(before).toEqual(snapshot);
  });

  it('weights recent answers over old ones', () => {
    const slipping = buildProfile(answers('counting', [...rights(5), ...wrongs(5)]));
    const improving = buildProfile(answers('counting', [...wrongs(5), ...rights(5)]));

    const a = findSkill(slipping, 'counting', 'K')!;
    const b = findSkill(improving, 'counting', 'K')!;

    // Same lifetime accuracy, opposite stories.
    expect(accuracy(a)).toBeCloseTo(accuracy(b));
    expect(a.strength).toBeLessThan(b.strength);
  });
});

describe('skill status', () => {
  it('says nothing about a topic it has barely seen', () => {
    const profile = buildProfile(answers('counting', wrongs(MIN_OBSERVATIONS - 1)));

    expect(skillStatus(findSkill(profile, 'counting', 'K'), 0)).toBe('new');
    expect(skillStatus(undefined, 0)).toBe('new');
    expect(hasPattern(profile)).toBe(false);
  });

  it('calls a topic struggling once enough answers have gone wrong', () => {
    const profile = buildProfile(answers('counting', [true, false, false, false, false]));

    expect(skillStatus(findSkill(profile, 'counting', 'K'), 0)).toBe('struggling');
    expect(hasPattern(profile)).toBe(true);
  });

  it('calls a topic developing while it is on its way', () => {
    const profile = buildProfile(answers('counting', [false, false, true, true, true]));

    expect(skillStatus(findSkill(profile, 'counting', 'K'), 0)).toBe('developing');
  });

  it('calls a topic secure after a run of right answers', () => {
    const profile = buildProfile(answers('counting', rights(6)));
    const skill = findSkill(profile, 'counting', 'K')!;

    expect(skillStatus(skill, skill.lastAnsweredAt)).toBe('secure');
  });

  it('one slip does not undo a secure topic', () => {
    const profile = buildProfile(answers('counting', [...rights(10), false]));
    const skill = findSkill(profile, 'counting', 'K')!;

    expect(skillStatus(skill, skill.lastAnsweredAt)).toBe('developing');
    expect(skill.strength).toBeGreaterThan(0.5);
  });

  it('asks for a secure topic again once it has had time to fade', () => {
    const profile = buildProfile(answers('counting', rights(6)));
    const skill = findSkill(profile, 'counting', 'K')!;

    expect(skillStatus(skill, skill.lastAnsweredAt + DAY)).toBe('secure');
    expect(skillStatus(skill, reviewDueAt(skill))).toBe('review-due');
  });

  it('leaves a well known topic alone for longer than a just learned one', () => {
    const justLearned = buildProfile(answers('counting', rights(4)));
    const wellKnown = buildProfile(answers('shapes', rights(12)));

    const a = findSkill(justLearned, 'counting', 'K')!;
    const b = findSkill(wellKnown, 'shapes', 'K')!;

    expect(reviewDueAt(b) - b.lastAnsweredAt).toBeGreaterThan(reviewDueAt(a) - a.lastAnsweredAt);
  });
});

describe('recentTopics', () => {
  it('lists the last topics answered, newest first', () => {
    const history = [
      ...answers('counting', [true], { from: 0 }),
      ...answers('shapes', [true], { from: DAY }),
      ...answers('adding', [true], { from: 2 * DAY }),
    ];

    expect(recentTopics(history, 2)).toEqual(['adding', 'shapes']);
    expect(recentTopics([], 3)).toEqual([]);
  });
});
