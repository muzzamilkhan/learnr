import {
  buildProfile,
  nextSkill,
  REVIEW_INTERVALS_MS,
  type Observation,
  type TopicSkill,
} from '../../src/lib/analytics/profile';
import { canonicaliseCase, digest } from './canonical';
import type { DigestSet } from './digests';

/**
 * A fixed moment to count days from, so nothing here reads the clock. Midnight
 * UTC on 1 January 2026 - `now` is injected everywhere in the engine, which is
 * what makes this set possible at all.
 */
const EPOCH = Date.UTC(2026, 0, 1);
const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

/** Sydney in winter, which is where the day boundary actually falls for this family. */
const SYDNEY = 600;

export interface Scenario {
  name: string;
  observations: Observation[];
}

const answer = (over: Partial<Observation> = {}): Observation => ({
  topic: 'subtraction',
  level: '1',
  correct: true,
  timeTakenMs: 4000,
  answeredAt: EPOCH,
  offsetMinutes: SYDNEY,
  ...over,
});

/** `n` answers, one an hour apart from `startAt`. */
const run = (
  n: number,
  correct: (i: number) => boolean,
  startAt = EPOCH,
  offsetMinutes = SYDNEY,
): Observation[] =>
  Array.from({ length: n }, (_, i) =>
    answer({ correct: correct(i), answeredAt: startAt + i * HOUR, offsetMinutes }),
  );

/**
 * Sequences built to reach each threshold, not sampled at random.
 *
 * Two traps are the point of the set. **`strength` is a recency-weighted float**
 * folded one answer at a time, so a few hundred observations is where two
 * languages' accumulation would part company if it were going to.
 * **`correctDays` is the child's day, not the server's** - each observation
 * carries the offset it was given at, and the fold only ever counts a day later
 * than the last counted, so answers arriving out of order undercount. Mastery is
 * delayed, never faked, and that asymmetry is exactly what a port implements
 * backwards.
 */
export const SCENARIOS: readonly Scenario[] = [
  { name: 'empty', observations: [] },
  { name: 'below-min-observations', observations: run(3, () => true) },
  { name: 'struggling', observations: run(12, (i) => i % 5 === 0) },
  { name: 'developing', observations: run(12, (i) => i % 3 !== 0) },
  {
    name: 'secure',
    observations: [
      ...run(6, () => true, EPOCH),
      ...run(6, () => true, EPOCH + DAY),
      ...run(6, () => true, EPOCH + 2 * DAY),
    ],
  },
  { name: 'long-run-strength', observations: run(300, (i) => i % 4 !== 0) },
  {
    name: 'days-across-offsets',
    // One instant is a different local day either side of the dateline, and a
    // missing offset means UTC rather than the last one seen.
    observations: [
      answer({ answeredAt: EPOCH + 13 * HOUR, offsetMinutes: SYDNEY }),
      answer({ answeredAt: EPOCH + 13 * HOUR, offsetMinutes: 0 }),
      answer({ answeredAt: EPOCH + 13 * HOUR, offsetMinutes: -480 }),
      answer({ answeredAt: EPOCH + 37 * HOUR, offsetMinutes: SYDNEY }),
      answer({ answeredAt: EPOCH + 37 * HOUR, offsetMinutes: undefined }),
    ],
  },
  {
    name: 'out-of-order-days',
    // Day 3, then day 1. The second must not count, which is the undercount.
    observations: [
      answer({ answeredAt: EPOCH + 2 * DAY }),
      answer({ answeredAt: EPOCH }),
      answer({ answeredAt: EPOCH + 3 * DAY }),
    ],
  },
  { name: 'all-wrong', observations: run(10, () => false) },
  { name: 'wrong-then-right', observations: run(20, (i) => i >= 10) },
  { name: 'right-then-wrong', observations: run(20, (i) => i < 10) },
  ...REVIEW_INTERVALS_MS.map((interval, i) => ({
    name: `review-interval-${i}`,
    observations: [
      ...Array.from({ length: i + 1 }, (_, d) => answer({ answeredAt: EPOCH + d * DAY })),
      answer({ answeredAt: EPOCH + (i + 1) * DAY + interval }),
    ],
  })),
];

/** `lastCorrectDay` stringifies as `"null"` where it is unset, and that is intended - a null day and day 0 are different things. */
const canonicalSkill = (skill: TopicSkill): string =>
  canonicaliseCase([
    ['topic', skill.topic],
    ['level', skill.level],
    ['attempts', String(skill.attempts)],
    ['correct', String(skill.correct)],
    ['strength', String(skill.strength)],
    ['streak', String(skill.streak)],
    ['correctDays', String(skill.correctDays)],
    ['lastCorrectDay', String(skill.lastCorrectDay)],
    ['totalTimeMs', String(skill.totalTimeMs)],
    ['lastAnsweredAt', String(skill.lastAnsweredAt)],
  ]);

/**
 * Each scenario folded twice: once through `nextSkill` a step at a time - so an
 * intermediate state that diverges names the observation it diverged on - and
 * once through `buildProfile`, which is the same arithmetic the stored row goes
 * through.
 */
export function profileSet(): DigestSet {
  const groups = new Map<string, string>();

  for (const { name, observations } of SCENARIOS) {
    const cases: string[] = [];
    let skill: TopicSkill | undefined;
    for (const observation of observations) {
      skill = nextSkill(skill, observation);
      cases.push(canonicalSkill(skill));
    }
    for (const built of buildProfile(observations).skills) cases.push(canonicalSkill(built));
    groups.set(name, digest(cases));
  }

  return { name: 'profile', groups };
}
