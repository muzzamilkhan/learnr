import { compareYearLevels, type YearLevel } from '../curriculum';
import {
  accuracy,
  averageTimeMs,
  buildProfile,
  localDay,
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
 * so everything here answers one of two questions - *where do I help?* and *is
 * it working?* - and it is honest about not knowing: a topic with three answers
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
  /** Lifetime accuracy - what a parent counts. */
  accuracy: number;
  /** Recency-weighted accuracy - what the selector acts on. */
  strength: number;
  streak: number;
  /** Separate days it has been got right on - the evidence behind calling it known. */
  correctDays: number;
  /** Average over answers, with abandoned questions capped by the session engine. */
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
 * half. Crude on purpose - a parent wants to know whether last week's help
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
        correctDays: skill.correctDays,
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

/**
 * The mirror of `problemTopics`: what to say well done about. Ordered by
 * `correctDays`, because that is the evidence that means something - four right
 * in a row is one memory answering four times, the same topic known again a week
 * later is not.
 *
 * `review-due` is left out even though those topics are mastered too.
 * `dueForReview` already lists them, and a topic appearing in two sections of
 * the same screen reads as a bug.
 */
export function strengths(reports: readonly TopicReport[], limit = 3): TopicReport[] {
  return reports
    .filter((report) => report.status === 'secure')
    .sort(
      (a, b) =>
        b.correctDays - a.correctDays ||
        b.strength - a.strength ||
        b.attempts - a.attempts ||
        compareYearLevels(a.level, b.level) ||
        a.topic.localeCompare(b.topic),
    )
    .slice(0, limit);
}

export interface Coverage {
  offered: number;
  practised: number;
  untouched: string[];
}

/**
 * How much of the year has been touched at all. A different question from the
 * status sections: this one is about breadth, and a child circling the same
 * three topics is worth knowing about even when they are doing well at them.
 *
 * Takes the level rather than trusting the caller to filter, because `reports`
 * spans every year the child has practised and `offered` covers exactly one.
 */
export function coverage(
  reports: readonly TopicReport[],
  offered: readonly string[],
  level: YearLevel,
): Coverage {
  const tried = new Set(
    reports.filter((report) => report.level === level && report.attempts > 0).map((report) => report.topic),
  );

  return {
    offered: offered.length,
    // Counted over `offered` rather than over `tried`, so a topic the child has
    // practised that this year no longer offers cannot push the figure past the total.
    practised: offered.filter((topic) => tried.has(topic)).length,
    untouched: offered.filter((topic) => !tried.has(topic)),
  };
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
 * Practice over time, one bucket per day or week, including the empty ones -
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

export interface CalendarDay extends ProgressBucket {
  /**
   * Later than `now` - a day that has not happened yet. A Friday nobody has
   * reached and a Friday nobody practised on are different things, and a grid
   * that drew them the same would report a gap that isn't there.
   */
  future: boolean;
}

/**
 * The practice calendar's grid: whole Monday-to-Sunday weeks, the last of which
 * contains today.
 *
 * Runs of seven ending today would need no alignment, but they also cannot
 * carry weekday labels - a column that is Monday one week and Thursday the next
 * is not a column. So the weeks are real calendar weeks and the tail of the
 * current one is marked `future` rather than left off, which keeps every row
 * seven cells wide.
 */
export function calendarWeeks(
  observations: readonly Observation[],
  { now, weeks = 4, offsetMinutes = 0 }: { now: number; weeks?: number; offsetMinutes?: number },
): CalendarDay[][] {
  const offsetMs = offsetMinutes * 60_000;
  const monday = bucketStart(now, 'week', offsetMs);
  const today = bucketStart(now, 'day', offsetMs);
  const first = monday - (weeks - 1) * WEEK_MS;

  // One request covering the whole grid, so the day counting stays in one place.
  const days = progressOverTime(observations, {
    now: monday + 6 * DAY_MS,
    unit: 'day',
    count: weeks * 7,
    offsetMinutes,
  }).filter((bucket) => bucket.start >= first);

  const grid = days.map((bucket) => ({ ...bucket, future: bucket.start > today }));

  return Array.from({ length: weeks }, (_, week) => grid.slice(week * 7, week * 7 + 7));
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

/**
 * The offset the child last answered at. Their days are what this report is
 * about, and the server has no timezone of its own - nor does it know the
 * parent's, who may well be reading this from another one. Every attempt
 * already carries the offset it was given at, so the most recent one is the
 * best answer available and needs no extra read.
 */
export function latestOffsetMinutes(observations: readonly Observation[]): number {
  let at = -Infinity;
  let offset = 0;

  for (const observation of observations) {
    if (observation.answeredAt >= at) {
      at = observation.answeredAt;
      offset = observation.offsetMinutes ?? 0;
    }
  }

  return offset;
}

export interface PeriodOptions {
  now: number;
  /** Local days per window, counting the one `now` falls in. */
  days?: number;
  /** Minutes east of UTC, e.g. 600 for Sydney in winter. */
  offsetMinutes?: number;
}

export interface Periods {
  current: Observation[];
  previous: Observation[];
}

/**
 * The last `days` days, and the `days` before those, so a figure can be shown
 * against the one it is meant to be read against. A bare "142 questions" says
 * nothing; "up from 98" is the whole point.
 *
 * Rolling rather than calendar-aligned on purpose: a Monday-aligned week reads
 * "0 questions this week" every Monday morning, which is exactly when a parent
 * is most likely to look.
 */
export function periods(
  observations: readonly Observation[],
  { now, days = 7, offsetMinutes = 0 }: PeriodOptions,
): Periods {
  const today = localDay(now, offsetMinutes);
  const opened = today - days + 1;
  const previouslyOpened = opened - days;

  const current: Observation[] = [];
  const previous: Observation[] = [];

  for (const observation of observations) {
    const day = localDay(observation.answeredAt, offsetMinutes);
    if (day >= opened && day <= today) current.push(observation);
    else if (day >= previouslyOpened && day < opened) previous.push(observation);
  }

  return { current, previous };
}

export interface Headline {
  /** Time on questions, rounded. Capped per answer by the session engine before it was stored. */
  minutes: number;
  questions: number;
  /** 0..1, or null when nothing was answered in the window. */
  accuracy: number | null;
  minutesDelta: number;
  questionsDelta: number;
  /** Points on the same 0..1 scale, or null when there is nothing to compare against. */
  accuracyDelta: number | null;
}

/**
 * The three figures at the top of the parents' screen. Arithmetic, so it lives
 * here and is tested, rather than being worked out inside a component where
 * nothing would ever check it.
 */
export function headline(observations: readonly Observation[], options: PeriodOptions): Headline {
  const { now, offsetMinutes = 0 } = options;
  const { current, previous } = periods(observations, options);

  const thisWindow = summarise(current, { now, offsetMinutes });
  const lastWindow = summarise(previous, { now, offsetMinutes });

  const minutes = Math.round(thisWindow.totalTimeMs / 60_000);

  return {
    minutes,
    questions: thisWindow.attempts,
    accuracy: thisWindow.attempts === 0 ? null : thisWindow.accuracy,
    minutesDelta: minutes - Math.round(lastWindow.totalTimeMs / 60_000),
    questionsDelta: thisWindow.attempts - lastWindow.attempts,
    // "Down 76 points" against a week the child did not practise is not a fact.
    accuracyDelta:
      thisWindow.attempts === 0 || lastWindow.attempts === 0
        ? null
        : thisWindow.accuracy - lastWindow.accuracy,
  };
}
