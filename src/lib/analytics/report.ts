import { compareYearLevels, type YearLevel } from '../curriculum';
import {
  accuracy,
  averageTimeMs,
  buildProfile,
  reviewDueAt,
  skillStatus,
  type Observation,
  type SkillStatus,
} from './profile';

/**
 * The parent's side of the same data the selector reads: which topics need a
 * hand, which are coming along, and whether the last few weeks went anywhere.
 *
 * It is written to be read by someone deciding what to sit down and help with,
 * so everything here answers one of two questions — *where do I help?* and *is
 * it working?* — and it is honest about not knowing: a topic with three answers
 * behind it is reported as `new`, never as a weakness.
 *
 * Days are bucketed against a caller-supplied UTC offset. The engine has no
 * timezone of its own, and a family in Sydney should not see Monday evening's
 * practice land on Tuesday.
 */

export type Trend = 'improving' | 'steady' | 'slipping' | 'unknown';

/** Under this many answers, the two halves are too small to mean anything. */
export const TREND_MIN_OBSERVATIONS = 6;

/** How much the halves must differ before it counts as a direction. */
export const TREND_DELTA = 0.15;

export interface TopicReport {
  topic: string;
  level: YearLevel;
  status: SkillStatus;
  attempts: number;
  correct: number;
  /** Lifetime accuracy — what a parent counts. */
  accuracy: number;
  /** Recency-weighted accuracy — what the selector acts on. */
  strength: number;
  streak: number;
  averageTimeMs: number;
  lastAnsweredAt: number;
  /** When this topic is worth revisiting, whether or not it is secure yet. */
  reviewDueAt: number;
  trend: Trend;
}

const key = (topic: string, level: string) => `${level}|${topic}`;

function groupByTopic(
  observations: readonly Observation[],
): Map<string, { topic: string; level: YearLevel; observations: Observation[] }> {
  const groups = new Map<string, { topic: string; level: YearLevel; observations: Observation[] }>();

  for (const observation of observations) {
    const id = key(observation.topic, observation.level);
    const group = groups.get(id) ?? {
      topic: observation.topic,
      level: observation.level,
      observations: [],
    };
    group.observations.push(observation);
    groups.set(id, group);
  }

  return groups;
}

const share = (observations: readonly Observation[]): number =>
  observations.length === 0
    ? 0
    : observations.filter((observation) => observation.correct).length / observations.length;

/**
 * Which way a topic is going: the older half of its answers against the newer
 * half. Crude on purpose — a parent wants to know whether last week's help
 * landed, not a regression coefficient.
 */
export function trendFor(observations: readonly Observation[]): Trend {
  if (observations.length < TREND_MIN_OBSERVATIONS) return 'unknown';

  const ordered = [...observations].sort((a, b) => a.answeredAt - b.answeredAt);
  const middle = Math.floor(ordered.length / 2);
  const delta = share(ordered.slice(middle)) - share(ordered.slice(0, middle));

  if (delta >= TREND_DELTA) return 'improving';
  if (delta <= -TREND_DELTA) return 'slipping';
  return 'steady';
}

/** Where a status sits in "what should we look at first". */
const NEED: Readonly<Record<SkillStatus, number>> = {
  struggling: 0,
  'review-due': 1,
  developing: 2,
  new: 3,
  secure: 4,
};

/** Every topic the child has answered, neediest first. */
export function topicReports(observations: readonly Observation[], now: number): TopicReport[] {
  const profile = buildProfile(observations);

  return [...groupByTopic(observations).values()]
    .map((group) => {
      const skill = profile.skills.find(
        (candidate) => candidate.topic === group.topic && candidate.level === group.level,
      )!;

      return {
        topic: group.topic,
        level: group.level,
        status: skillStatus(skill, now),
        attempts: skill.attempts,
        correct: skill.correct,
        accuracy: accuracy(skill),
        strength: skill.strength,
        streak: skill.streak,
        averageTimeMs: averageTimeMs(skill),
        lastAnsweredAt: skill.lastAnsweredAt,
        reviewDueAt: reviewDueAt(skill),
        trend: trendFor(group.observations),
      };
    })
    .sort(
      (a, b) =>
        NEED[a.status] - NEED[b.status] ||
        a.strength - b.strength ||
        b.attempts - a.attempts ||
        compareYearLevels(a.level, b.level) ||
        a.topic.localeCompare(b.topic),
    );
}

/**
 * The topics worth sitting down with, and nothing else. A list padded out with
 * topics that are merely unproven would send a parent to help with something
 * that is not a problem, and cost the real ones their attention.
 */
export function problemTopics(reports: readonly TopicReport[], limit = 3): TopicReport[] {
  return reports.filter((report) => report.status === 'struggling').slice(0, limit);
}

/** Topics that have gone quiet long enough to be worth coming back to. */
export function dueForReview(reports: readonly TopicReport[], limit = 3): TopicReport[] {
  return reports.filter((report) => report.status === 'review-due').slice(0, limit);
}

export type BucketUnit = 'day' | 'week';

export interface ProgressBucket {
  /** Start of the bucket, as a timestamp in the caller's local day. */
  start: number;
  unit: BucketUnit;
  attempts: number;
  correct: number;
  /** Accuracy over the bucket, or null when nothing was practised. */
  accuracy: number | null;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_MS = 7 * DAY_MS;
/** 1 January 1970 was a Thursday, so weeks are aligned back to the Monday before it. */
const WEEK_ALIGN = 3 * DAY_MS;

const unitMs = (unit: BucketUnit) => (unit === 'day' ? DAY_MS : WEEK_MS);

function bucketStart(time: number, unit: BucketUnit, offsetMs: number): number {
  const size = unitMs(unit);
  const align = unit === 'week' ? WEEK_ALIGN : 0;
  return Math.floor((time + offsetMs + align) / size) * size - align - offsetMs;
}

export interface ProgressOptions {
  now: number;
  unit?: BucketUnit;
  /** How many buckets back, including the one `now` falls in. */
  count?: number;
  /** Minutes east of UTC, e.g. 600 for Sydney in winter. */
  offsetMinutes?: number;
}

/**
 * Practice over time, one bucket per day or week, including the empty ones —
 * the gaps are half the story a parent is reading the chart for.
 */
export function progressOverTime(
  observations: readonly Observation[],
  { now, unit = 'day', count = 14, offsetMinutes = 0 }: ProgressOptions,
): ProgressBucket[] {
  const offsetMs = offsetMinutes * 60_000;
  const size = unitMs(unit);
  const latest = bucketStart(now, unit, offsetMs);
  const earliest = latest - (count - 1) * size;

  const buckets = new Map<number, ProgressBucket>();
  for (let start = earliest; start <= latest; start += size) {
    buckets.set(start, { start, unit, attempts: 0, correct: 0, accuracy: null });
  }

  for (const observation of observations) {
    const bucket = buckets.get(bucketStart(observation.answeredAt, unit, offsetMs));
    if (!bucket) continue;
    bucket.attempts += 1;
    if (observation.correct) bucket.correct += 1;
  }

  return [...buckets.values()]
    .sort((a, b) => a.start - b.start)
    .map((bucket) => ({
      ...bucket,
      accuracy: bucket.attempts === 0 ? null : bucket.correct / bucket.attempts,
    }));
}

export interface Summary {
  attempts: number;
  correct: number;
  accuracy: number;
  totalTimeMs: number;
  /** Distinct local days with at least one answer. */
  daysPracticed: number;
  topics: number;
  secure: number;
  struggling: number;
  lastAnsweredAt: number | null;
}

export function summarise(
  observations: readonly Observation[],
  { now, offsetMinutes = 0 }: { now: number; offsetMinutes?: number },
): Summary {
  const reports = topicReports(observations, now);
  const days = new Set(
    observations.map((observation) => bucketStart(observation.answeredAt, 'day', offsetMinutes * 60_000)),
  );
  const correct = observations.filter((observation) => observation.correct).length;

  return {
    attempts: observations.length,
    correct,
    accuracy: observations.length === 0 ? 0 : correct / observations.length,
    totalTimeMs: observations.reduce((total, observation) => total + observation.timeTakenMs, 0),
    daysPracticed: days.size,
    topics: reports.length,
    secure: reports.filter((report) => report.status === 'secure' || report.status === 'review-due')
      .length,
    struggling: reports.filter((report) => report.status === 'struggling').length,
    lastAnsweredAt: observations.reduce<number | null>(
      (latest, observation) => (latest === null ? observation.answeredAt : Math.max(latest, observation.answeredAt)),
      null,
    ),
  };
}
