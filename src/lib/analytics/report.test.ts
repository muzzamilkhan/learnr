import { describe, it, expect } from 'vitest';

import {
  dueForReview,
  problemTopics,
  progressOverTime,
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

describe('topicReports', () => {
  const history = [
    ...answers('counting', [true, false, false, false, false]),
    ...answers('addition', rights(6)),
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
    const reports = topicReports(answers('addition', rights(4)), NOW + 20 * DAY);

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
      ...answers('addition', rights(6), { endedAt: NOW - DAY }),
    ];

    expect(summarise(history, { now: NOW })).toMatchObject({
      attempts: 11,
      correct: 7,
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
