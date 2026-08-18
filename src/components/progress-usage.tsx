import { calendarWeeks, dailyTotals, headline, topicReports } from '@/lib/analytics/report';
import type { Observation } from '@/lib/analytics/profile';
import type { DailyTarget, TargetAnswer } from '@/lib/rewards/target';
import { yearLabel } from '@/lib/curriculum';
import { PracticeCalendar, elapsedDays, practisedDays } from './practice-calendar';
import { TopicBars, type TopicBar } from './topic-bars';
import { Well } from './well';

/** Four weeks. Recent enough to be about now, and it fills the width at a readable size. */
const CALENDAR_WEEKS = 4;

/** Beyond this the labels stop being readable on an iPad; the coverage line covers the tail. */
const MAX_BARS = 8;

/**
 * The "are they using it?" half of the parents' screen: three figures against
 * last week, four weeks of days, and how much of each topic has been answered.
 */
export function ProgressUsage({
  observations,
  targetAnswers,
  target,
  now,
  offsetMinutes,
}: {
  observations: Observation[];
  /**
   * The calendar's own read, across every subject - a daily goal is the child's
   * whole day, where everything else on this screen is scoped to one subject.
   * `null` means that read failed: the goal is dropped from the calendar rather
   * than every day being drawn as a day that missed it.
   */
  targetAnswers: TargetAnswer[] | null;
  target: DailyTarget | null;
  now: number;
  offsetMinutes: number;
}) {
  const figures = headline(observations, { now, offsetMinutes });
  const weeks = calendarWeeks(observations, { now, weeks: CALENDAR_WEEKS, offsetMinutes });
  const totals = targetAnswers === null ? null : dailyTotals(targetAnswers, { offsetMinutes });
  // Without the day totals there is nothing to measure a goal against, so the
  // calendar goes back to plain shading and the note stops claiming otherwise.
  const measured = target !== null && totals !== null ? target : null;

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
    <section className="space-y-4">
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
            value={figures.accuracy === null ? '-' : `${Math.round(figures.accuracy * 100)}%`}
            delta={figures.accuracyDelta === null ? null : Math.round(figures.accuracyDelta * 100)}
            unit="pts"
          />
        </div>
        {/* Without this a parent reads 76% as a C. The selector mixes hard topics
            in deliberately, so a healthy child sits in the seventies. */}
        <p className="mt-2 text-sm text-(--color-ink-soft)">
          Over the last 7 days, against the 7 before. Questions are picked to stretch - around
          three in four right means it&rsquo;s working.
        </p>
      </div>

      <Well
        title="Practice"
        aside={`${practisedDays(weeks)} of the last ${elapsedDays(weeks)} days`}
        // Past days are measured against the goal as it stands now - a goal that
        // has been changed was not stored per day, and saying so is what keeps a
        // re-judged fortnight from being a surprise.
        note={
          measured
            ? `Green days met their goal of ${measured.value} ${
                measured.kind === 'minutes' ? 'minutes' : 'questions'
              } a day. Part-filled days came close.`
            : target
              ? // The goal is set but the read behind it failed. The panel says so
                // rather than quietly losing the goal - "could not read" and
                // "nothing recorded" have to look different to a parent.
                'Couldn’t check these days against their goal just now.'
              : undefined
        }
      >
        <PracticeCalendar
          weeks={weeks}
          offsetMinutes={offsetMinutes}
          target={measured}
          totals={totals}
        />
      </Well>

      {bars.length > 0 ? (
        <Well title="Topics" note="How many questions each topic has had, and how many were right.">
          <TopicBars data={bars} />
        </Well>
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
