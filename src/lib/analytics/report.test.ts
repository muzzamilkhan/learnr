import { describe, it, expect } from 'vitest';

import {
  coverage,
  dueForReview,
  headline,
  latestOffsetMinutes,
  periods,
  problemTopics,
  progressOverTime,
  strengths,
  summarise,
  topicReports,
  trendFor,
} from './report';
import type { Observation } from './profile';
import type { YearLevel } from '../curriculum';

const DAY = 24 * 60 * 60 * 1000;
/** A Wednesday, mid-morning UTC. */
const NOW = Date.UTC(2026, 7, 12, 9, 0);

function answers(
  topic: string,
  results: boolean[],
  { endedAt = NOW - DAY, level = 'K', timeTakenMs = 5000 }: { endedAt?: number; level?: YearLevel; timeTakenMs?: number } = {},
): Observation[] {
  return results.map((correct, index) => ({
    topic,
    level,
    correct,
    timeTakenMs,
    answeredAt: endedAt - (results.length - 1 - index) * 60_000,
  }));
}

const rights = (n: number) => Array(n).fill(true);
const wrongs = (n: number) => Array(n).fill(false);

/** What knowing a topic looks like: four right on each of `days` separate days, ending yesterday. */
const known = (topic: string, days = 2): Observation[] =>
  Array.from({ length: days }, (_, day) =>
    answers(topic, rights(4), { endedAt: NOW - DAY - (days - 1 - day) * DAY }),
  ).flat();

describe('topicReports', () => {
  const history = [
    ...answers('counting', [true, false, false, false, false]),
    ...known('addition'),
    ...answers('shapes', [true, false]),
  ];

  it('puts what needs help first and what is known last', () => {
    const reports = topicReports(history, NOW);

    expect(reports.map((report) => report.topic)).toEqual(['counting', 'shapes', 'addition']);
    expect(reports.map((report) => report.status)).toEqual(['struggling', 'new', 'secure']);
  });

  it('reports the numbers a parent reads, not just the ones the engine uses', () => {
    const [counting] = topicReports(history, NOW);

    expect(counting).toMatchObject({
      topic: 'counting',
      level: 'K',
      attempts: 5,
      correct: 1,
      accuracy: 0.2,
      averageTimeMs: 5000,
    });
    expect(counting.strength).toBeLessThan(0.6);
  });

  it('keeps the same topic at two levels apart', () => {
    const reports = topicReports(
      [...answers('counting', wrongs(5)), ...answers('counting', rights(5), { level: '1' })],
      NOW,
    );

    expect(reports.map((report) => [report.topic, report.level])).toEqual([
      ['counting', 'K'],
      ['counting', '1'],
    ]);
  });

  it('names only real problems, never merely unproven topics', () => {
    const reports = topicReports(history, NOW);

    expect(problemTopics(reports).map((report) => report.topic)).toEqual(['counting']);
  });

  it('lists a mastered topic for review once it has had time to fade', () => {
    const reports = topicReports(known('addition'), NOW + 20 * DAY);

    expect(reports[0].status).toBe('review-due');
    expect(dueForReview(reports).map((report) => report.topic)).toEqual(['addition']);
  });

  it('reports an empty history as nothing at all', () => {
    expect(topicReports([], NOW)).toEqual([]);
    expect(problemTopics([])).toEqual([]);
  });
});

describe('trendFor', () => {
  it('says nothing from too few answers', () => {
    expect(trendFor(answers('counting', [false, true, false]))).toBe('unknown');
  });

  it('spots a topic getting better and one slipping', () => {
    expect(trendFor(answers('counting', [...wrongs(4), ...rights(4)]))).toBe('improving');
    expect(trendFor(answers('counting', [...rights(4), ...wrongs(4)]))).toBe('slipping');
    expect(trendFor(answers('counting', [true, false, true, false, true, false, true, false]))).toBe(
      'steady',
    );
  });
});

describe('progressOverTime', () => {
  it('returns a bucket a day, including the days nothing was practised', () => {
    const buckets = progressOverTime(answers('counting', [true, false], { endedAt: NOW }), {
      now: NOW,
      count: 7,
    });

    expect(buckets).toHaveLength(7);
    expect(buckets.slice(0, 6).every((bucket) => bucket.attempts === 0)).toBe(true);
    expect(buckets.at(-1)).toMatchObject({ attempts: 2, correct: 1, accuracy: 0.5 });
  });

  it('leaves accuracy unset on a day with no practice, rather than calling it zero', () => {
    const [first] = progressOverTime([], { now: NOW, count: 3 });

    expect(first.accuracy).toBeNull();
  });

  it('drops anything older than the window', () => {
    const old = answers('counting', rights(3), { endedAt: NOW - 30 * DAY });
    const recent = answers('counting', rights(2), { endedAt: NOW });

    const buckets = progressOverTime([...old, ...recent], { now: NOW, count: 7 });

    expect(buckets.reduce((total, bucket) => total + bucket.attempts, 0)).toBe(2);
  });

  it('buckets by the family’s local day, not by UTC', () => {
    // 8am Sydney on the 13th is 22:00 UTC on the 12th.
    const morning = Date.UTC(2026, 7, 12, 22, 0);
    const observations = answers('counting', rights(1), { endedAt: morning });

    const sydney = progressOverTime(observations, {
      now: morning,
      count: 2,
      offsetMinutes: 600,
    });
    const utc = progressOverTime(observations, { now: morning, count: 2 });

    expect(sydney.at(-1)!.attempts).toBe(1);
    expect(utc.at(-1)!.attempts).toBe(1);
    // The same answer, filed under different days.
    expect(sydney.at(-1)!.start).not.toBe(utc.at(-1)!.start);
  });

  it('buckets by week when asked, starting on Mondays', () => {
    const buckets = progressOverTime(answers('counting', rights(4), { endedAt: NOW }), {
      now: NOW,
      unit: 'week',
      count: 4,
    });

    expect(buckets).toHaveLength(4);
    expect(buckets.at(-1)!.attempts).toBe(4);
    expect(new Date(buckets.at(-1)!.start).getUTCDay()).toBe(1);
  });
});

describe('summarise', () => {
  it('counts the practice behind the report', () => {
    const history = [
      ...answers('counting', [true, false, false, false, false], { endedAt: NOW - 2 * DAY }),
      ...known('addition'),
    ];

    expect(summarise(history, { now: NOW })).toMatchObject({
      attempts: 13,
      correct: 9,
      daysPracticed: 2,
      topics: 2,
      secure: 1,
      struggling: 1,
    });
  });

  it('has something to say before anything has been answered', () => {
    expect(summarise([], { now: NOW })).toMatchObject({
      attempts: 0,
      accuracy: 0,
      daysPracticed: 0,
      topics: 0,
      lastAnsweredAt: null,
    });
  });
});

describe('latestOffsetMinutes', () => {
  it('is zero when there is no history to read one from', () => {
    expect(latestOffsetMinutes([])).toBe(0);
  });

  it('takes the offset of the most recent answer, not the first', () => {
    const history = [
      { topic: 'addition', level: 'K' as YearLevel, correct: true, timeTakenMs: 5000, answeredAt: NOW - DAY, offsetMinutes: 60 },
      { topic: 'addition', level: 'K' as YearLevel, correct: true, timeTakenMs: 5000, answeredAt: NOW - 2 * DAY, offsetMinutes: 600 },
    ];

    expect(latestOffsetMinutes(history)).toBe(60);
  });

  it('reads a missing offset as UTC', () => {
    expect(latestOffsetMinutes(answers('addition', rights(2)))).toBe(0);
  });
});

describe('periods', () => {
  it('splits a history into this window and the one before it', () => {
    const history = [
      ...answers('addition', rights(3), { endedAt: NOW - DAY }),
      ...answers('addition', rights(2), { endedAt: NOW - 9 * DAY }),
      ...answers('addition', rights(4), { endedAt: NOW - 30 * DAY }),
    ];

    const { current, previous } = periods(history, { now: NOW, days: 7 });

    expect(current).toHaveLength(3);
    expect(previous).toHaveLength(2);
  });

  it('counts today and excludes the day the window opened on', () => {
    // days: 7 means today and the six before it — day -6 is in, day -7 is not.
    const history = [
      ...answers('addition', rights(1), { endedAt: NOW }),
      ...answers('addition', rights(1), { endedAt: NOW - 6 * DAY }),
      ...answers('addition', rights(1), { endedAt: NOW - 7 * DAY }),
    ];

    const { current, previous } = periods(history, { now: NOW, days: 7 });

    expect(current).toHaveLength(2);
    expect(previous).toHaveLength(1);
  });

  it('buckets against the offset it is given, not the server', () => {
    // 22:00 UTC is already the next day in Sydney (+600), so with that offset
    // this answer falls a day later than it does in UTC.
    const late = [
      {
        topic: 'addition',
        level: 'K' as YearLevel,
        correct: true,
        timeTakenMs: 5000,
        answeredAt: Date.UTC(2026, 7, 5, 22, 0),
      },
    ];

    expect(periods(late, { now: NOW, days: 7, offsetMinutes: 0 }).current).toHaveLength(0);
    expect(periods(late, { now: NOW, days: 7, offsetMinutes: 600 }).current).toHaveLength(1);
  });
});

describe('headline', () => {
  const history = [
    ...answers('addition', [...rights(6), ...wrongs(2)], { endedAt: NOW - DAY, timeTakenMs: 30_000 }),
    ...answers('addition', [...rights(2), ...wrongs(2)], { endedAt: NOW - 9 * DAY, timeTakenMs: 30_000 }),
  ];

  it('reports the window and how it compares with the one before', () => {
    expect(headline(history, { now: NOW, days: 7 })).toMatchObject({
      minutes: 4, // 8 answers x 30s
      questions: 8,
      accuracy: 0.75,
      minutesDelta: 2, // against 4 answers x 30s = 2 minutes
      questionsDelta: 4,
    });
  });

  it('measures the accuracy delta in points on the same scale', () => {
    const { accuracyDelta } = headline(history, { now: NOW, days: 7 });

    expect(accuracyDelta).toBeCloseTo(0.25); // 0.75 this window against 0.5 last
  });

  it('has no accuracy to report when nothing was answered this window', () => {
    const stale = answers('addition', rights(4), { endedAt: NOW - 30 * DAY });

    expect(headline(stale, { now: NOW, days: 7 })).toMatchObject({
      questions: 0,
      accuracy: null,
      accuracyDelta: null,
    });
  });

  it('will not compare against a window the child did not practise in', () => {
    const fresh = answers('addition', rights(4), { endedAt: NOW - DAY });

    expect(headline(fresh, { now: NOW, days: 7 })).toMatchObject({
      questions: 4,
      accuracy: 1,
      questionsDelta: 4,
      accuracyDelta: null,
    });
  });
});

describe('strengths', () => {
  it('lists what the child has, best evidence first', () => {
    const history = [...known('addition', 4), ...known('shapes', 2), ...answers('counting', wrongs(6))];
    const reports = topicReports(history, NOW);

    expect(strengths(reports).map((report) => report.topic)).toEqual(['addition', 'shapes']);
  });

  it('leaves a topic that is due for review to dueForReview', () => {
    // Known, then left alone long enough that it is worth confirming again.
    const stale = topicReports(known('addition', 2).map((o) => ({ ...o, answeredAt: o.answeredAt - 20 * DAY })), NOW);

    expect(stale[0].status).toBe('review-due');
    expect(strengths(stale)).toEqual([]);
    expect(dueForReview(stale)).toHaveLength(1);
  });

  it('says nothing when nothing is proven yet', () => {
    expect(strengths(topicReports(answers('counting', rights(2)), NOW))).toEqual([]);
  });
});

describe('coverage', () => {
  const offered = ['addition', 'counting', 'shapes', 'subtraction'];

  it('counts what has been tried against what the year offers', () => {
    const reports = topicReports(
      [...answers('addition', rights(3), { level: '1' }), ...answers('shapes', wrongs(1), { level: '1' })],
      NOW,
    );

    expect(coverage(reports, offered, '1')).toEqual({
      offered: 4,
      practised: 2,
      untouched: ['counting', 'subtraction'],
    });
  });

  it('counts a single attempt as tried — this is not a question about mastery', () => {
    const reports = topicReports(answers('counting', wrongs(1), { level: '1' }), NOW);

    expect(coverage(reports, offered, '1').practised).toBe(1);
  });

  it('ignores practice at another year level', () => {
    const reports = topicReports(answers('addition', rights(3), { level: 'K' }), NOW);

    expect(coverage(reports, offered, '1')).toMatchObject({ practised: 0, offered: 4 });
  });
});
