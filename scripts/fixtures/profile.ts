import {
  buildProfile,
  nextSkill,
  reviewIntervalMs,
  REVIEW_INTERVALS_MS,
  skillStatus,
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
    // **These instants are chosen so the offset actually decides the day.** At
    // 15h UTC, Sydney is already on the next day while UTC and California are
    // not - the day is the child's, not the server's, and that is the whole
    // claim. At 44h a missing offset lands a day earlier than Sydney's, so
    // `undefined` is provably UTC rather than the last offset seen.
    //
    // An earlier version used 13h and 37h, where every offset resolved to the
    // same local day and the scenario proved nothing while claiming to.
    observations: [
      answer({ answeredAt: EPOCH + 15 * HOUR, offsetMinutes: SYDNEY }),
      answer({ answeredAt: EPOCH + 15 * HOUR, offsetMinutes: 0 }),
      answer({ answeredAt: EPOCH + 15 * HOUR, offsetMinutes: -480 }),
      answer({ answeredAt: EPOCH + 44 * HOUR, offsetMinutes: SYDNEY }),
      answer({ answeredAt: EPOCH + 44 * HOUR, offsetMinutes: undefined }),
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
export const canonicalSkill = (skill: TopicSkill): string =>
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
 * The derived reads. The stored row does not contain them and a port must
 * reproduce them anyway: `skillStatus` is what the selector keys off entirely,
 * and `reviewIntervalMs` decides when a mastered topic comes back.
 *
 * Taken at two instants, because status is a function of `now` as well as of
 * the row. Without the second, **`review-due` is unreachable** - every scenario
 * stops at `secure` and one of the five statuses goes uncovered no matter how
 * many scenarios are added.
 */
const canonicalStatus = (skill: TopicSkill): string[] => {
  const interval = reviewIntervalMs(skill);
  return [
    ['end', skill.lastAnsweredAt],
    ['due', skill.lastAnsweredAt + interval],
  ].map(([at, now]) =>
    canonicaliseCase([
      ['at', String(at)],
      ['reviewIntervalMs', String(interval)],
      ['status', skillStatus(skill, Number(now))],
    ]),
  );
};

/**
 * Each scenario folded twice: once through `nextSkill` a step at a time - so an
 * intermediate state that diverges names the observation it diverged on - and
 * once through `buildProfile`, which is the same arithmetic the stored row goes
 * through. Both matter: `buildProfile` **sorts** by `answeredAt` before folding,
 * so the out-of-order undercount `nextSkill` produces can only show up on the
 * step-at-a-time path - folding only through `buildProfile` would make
 * `out-of-order-days` pin nothing.
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
    if (skill) cases.push(...canonicalStatus(skill));
    groups.set(name, digest(cases));
  }

  return { name: 'profile', groups };
}
