import { headline, progressOverTime, topicReports } from '@/lib/analytics/report';
import type { Observation } from '@/lib/analytics/profile';
import { yearLabel } from '@/lib/curriculum';
import { PracticeCalendar, practisedDays } from './practice-calendar';
import { TopicBars, type TopicBar } from './topic-bars';

/** Eight weeks. Long enough for a habit to show, short enough for the squares to stay big. */
const CALENDAR_DAYS = 56;

/** Beyond this the labels stop being readable on an iPad; the coverage line covers the tail. */
const MAX_BARS = 8;

/**
 * The "are they using it?" half of the parents' screen: three figures against
 * last week, eight weeks of days, and how much of each topic has been answered.
 */
export function ProgressUsage({
  observations,
  now,
  offsetMinutes,
}: {
  observations: Observation[];
  now: number;
  offsetMinutes: number;
}) {
  const figures = headline(observations, { now, offsetMinutes });
  const buckets = progressOverTime(observations, {
    now,
    unit: 'day',
    count: CALENDAR_DAYS,
    offsetMinutes,
  });

  const reports = topicReports(observations, now);
  // The same topic can appear at two years once a child moves up, so the year is
  // shown only when it is actually needed to tell two bars apart.
  const repeated = new Set(
    reports
      .map((report) => report.topic)
      .filter((topic, index, all) => all.indexOf(topic) !== index),
  );

  const bars: TopicBar[] = [...reports]
    .sort((a, b) => b.attempts - a.attempts || a.topic.localeCompare(b.topic))
    .slice(0, MAX_BARS)
    .map((report) => ({
      label: repeated.has(report.topic)
        ? `${report.topic} (${yearLabel(report.level)})`
        : report.topic,
      correct: report.correct,
      wrong: report.attempts - report.correct,
    }));

  return (
    <section className="space-y-8">
      <div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Tile
            label="Time on questions"
            value={`${figures.minutes} min`}
            delta={figures.minutesDelta}
            unit="min"
          />
          <Tile label="Questions" value={String(figures.questions)} delta={figures.questionsDelta} />
          <Tile
            label="Correct"
            value={figures.accuracy === null ? '—' : `${Math.round(figures.accuracy * 100)}%`}
            delta={figures.accuracyDelta === null ? null : Math.round(figures.accuracyDelta * 100)}
            unit="pts"
          />
        </div>
        {/* Without this a parent reads 76% as a C. The selector mixes hard topics
            in deliberately, so a healthy child sits in the seventies. */}
        <p className="mt-2 text-sm text-(--color-ink-soft)">
          Over the last 7 days, against the 7 before. Questions are picked to stretch — around
          three in four right means it&rsquo;s working.
        </p>
      </div>

      <div>
        <div className="mb-2 flex items-baseline justify-between gap-4">
          <h2 className="text-lg font-semibold">Practice</h2>
          <p className="text-sm text-(--color-ink-soft)">
            {practisedDays(buckets)} of the last {CALENDAR_DAYS} days
          </p>
        </div>
        <PracticeCalendar buckets={buckets} offsetMinutes={offsetMinutes} />
      </div>

      {bars.length > 0 ? (
        <div>
          <h2 className="mb-0.5 text-lg font-semibold">Topics</h2>
          <p className="mb-2 text-sm text-(--color-ink-soft)">
            How many questions each topic has had, and how many were right.
          </p>
          <TopicBars data={bars} />
        </div>
      ) : null}
    </section>
  );
}

function Tile({
  label,
  value,
  delta,
  unit,
}: {
  label: string;
  value: string;
  delta: number | null;
  unit?: string;
}) {
  return (
    <div className="rounded-xl border border-(--color-line) bg-(--color-card) p-4">
      <p className="text-sm text-(--color-ink-soft)">{label}</p>
      <p className="mt-0.5 text-2xl font-bold tabular-nums">{value}</p>
      <p className="mt-0.5 text-xs text-(--color-ink-soft)">
        {delta === null || delta === 0 ? (
          delta === 0 ? 'Same as last week' : 'No comparison yet'
        ) : (
          <>
            {delta > 0 ? '↑' : '↓'} {Math.abs(delta)}
            {unit ? ` ${unit}` : ''} on last week
          </>
        )}
      </p>
    </div>
  );
}
