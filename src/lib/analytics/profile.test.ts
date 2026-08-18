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
  {
    from = 0,
    timeTakenMs = 5000,
    offsetMinutes,
  }: { from?: number; timeTakenMs?: number; offsetMinutes?: number } = {},
): Observation[] {
  return results.map((correct, index) => ({
    topic,
    level: 'K' as const,
    correct,
    timeTakenMs,
    answeredAt: from + index * 60_000,
    offsetMinutes,
  }));
}

const rights = (n: number) => Array(n).fill(true);
const wrongs = (n: number) => Array(n).fill(false);

/** What knowing a topic looks like: four right answers on each of `days` separate days. */
const known = (topic: string, days: number): Observation[] =>
  Array.from({ length: days }, (_, day) => answers(topic, rights(4), { from: day * DAY })).flat();

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

  it('calls a topic secure once it has been got right again on another day', () => {
    const profile = buildProfile(known('counting', 2));
    const skill = findSkill(profile, 'counting', 'K')!;

    expect(skillStatus(skill, skill.lastAnsweredAt)).toBe('secure');
  });

  it('will not call a topic secure on one sitting, however long the run', () => {
    const profile = buildProfile(answers('counting', rights(20)));
    const skill = findSkill(profile, 'counting', 'K')!;

    // Twenty in a row, all in ten minutes: that is one memory answering twenty
    // times, and it is not the same thing as still knowing it tomorrow.
    expect(skill.streak).toBe(20);
    expect(skill.correctDays).toBe(1);
    expect(skillStatus(skill, skill.lastAnsweredAt)).toBe('developing');
  });

  it('will not call a topic secure on a couple of answers a day apart either', () => {
    const profile = buildProfile([
      ...answers('counting', rights(2), { from: 0 }),
      ...answers('counting', rights(2), { from: DAY }),
    ]);
    const skill = findSkill(profile, 'counting', 'K')!;

    expect(skill.correctDays).toBe(2);
    expect(skillStatus(skill, skill.lastAnsweredAt)).toBe('developing');
  });

  it('counts a day once, however many answers it holds', () => {
    const profile = buildProfile([
      ...answers('counting', rights(5), { from: 0 }),
      ...answers('counting', rights(5), { from: 3 * DAY }),
    ]);

    expect(findSkill(profile, 'counting', 'K')!.correctDays).toBe(2);
  });

  it('will not inflate the days from answers arriving out of order', () => {
    const monday = answers('counting', rights(4), { from: 0 });
    const tuesday = answers('counting', rights(4), { from: DAY });

    // Folded as they arrive rather than as they happened - two writes landing at
    // once, or a retry overtaking. Alternating days must not read as eight.
    const jumbled = [tuesday[0], monday[0], tuesday[1], monday[1], tuesday[2], monday[2]].reduce(
      applyObservation,
      emptyProfile(),
    );

    expect(findSkill(jumbled, 'counting', 'K')!.correctDays).toBeLessThanOrEqual(2);
  });

  it('counts the day the child was in, not UTC', () => {
    // Morning and evening of one Sydney day (+11), which straddles UTC midnight:
    // 10am on the 1st is 23:00 UTC on the 31st, 8pm is 09:00 UTC on the 1st.
    const morning = Date.UTC(2025, 11, 31, 23, 0);
    const evening = Date.UTC(2026, 0, 1, 9, 0);
    const sydney = { offsetMinutes: 660 };

    const local = buildProfile([
      ...answers('counting', rights(1), { from: morning, ...sydney }),
      ...answers('counting', rights(1), { from: evening, ...sydney }),
    ]);
    const utc = buildProfile([
      ...answers('counting', rights(1), { from: morning }),
      ...answers('counting', rights(1), { from: evening }),
    ]);

    // One day of practice for the family that lived it, two for the server.
    expect(findSkill(local, 'counting', 'K')!.correctDays).toBe(1);
    expect(findSkill(utc, 'counting', 'K')!.correctDays).toBe(2);
  });

  it('one slip does not undo a secure topic', () => {
    const profile = buildProfile([...known('counting', 2), ...answers('counting', [false], { from: 5 * DAY })]);
    const skill = findSkill(profile, 'counting', 'K')!;

    expect(skillStatus(skill, skill.lastAnsweredAt)).toBe('developing');
    expect(skill.strength).toBeGreaterThan(0.5);
  });

  it('asks for a secure topic again once it has had time to fade', () => {
    const profile = buildProfile(known('counting', 2));
    const skill = findSkill(profile, 'counting', 'K')!;

    expect(skillStatus(skill, skill.lastAnsweredAt + DAY)).toBe('secure');
    expect(skillStatus(skill, reviewDueAt(skill))).toBe('review-due');
  });

  it('leaves a well known topic alone for longer than a just learned one', () => {
    const justLearned = buildProfile(known('counting', 2));
    const wellKnown = buildProfile(known('shapes', 5));

    const a = findSkill(justLearned, 'counting', 'K')!;
    const b = findSkill(wellKnown, 'shapes', 'K')!;

    expect(skillStatus(a, a.lastAnsweredAt)).toBe('secure');
    expect(skillStatus(b, b.lastAnsweredAt)).toBe('secure');
    expect(reviewDueAt(b) - b.lastAnsweredAt).toBeGreaterThan(reviewDueAt(a) - a.lastAnsweredAt);
  });

  it('grows the gap with days come back to, not with the run', () => {
    const marathon = buildProfile(answers('counting', rights(40)));
    const spaced = buildProfile(known('shapes', 4));

    const a = findSkill(marathon, 'counting', 'K')!;
    const b = findSkill(spaced, 'shapes', 'K')!;

    expect(a.streak).toBeGreaterThan(b.streak);
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
