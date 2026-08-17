import { templatesFor, topicsForLevel } from '@/content/catalog';
import { MIN_OBSERVATIONS, type Observation } from '@/lib/analytics/profile';
import {
  coverage,
  dueForReview,
  problemTopics,
  strengths,
  topicReports,
  type TopicReport,
} from '@/lib/analytics/report';
import { yearLabel, type YearLevel } from '@/lib/curriculum';
import { localDay } from '@/lib/day';
import type { Sitting } from '@/lib/records';
import { createRng } from '@/lib/rng';
import { generateQuestion } from '@/lib/templates/generate';

/**
 * The "where do they need help?" half. Every list here refuses to guess: under
 * `MIN_OBSERVATIONS` answers a topic is `new`, never a weakness, so a child who
 * has just started gets an honest "not enough answers yet" rather than a
 * diagnosis built from two data points.
 */

const DATE = new Intl.DateTimeFormat('en-AU', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  // The timestamp is already shifted into the child's day below, so it is read
  // back as UTC rather than through whatever timezone the server happens to be in.
  timeZone: 'UTC',
});

/**
 * One real question from this topic, so "fractions are hard" becomes something a
 * parent can sit down and do. Seeded from the template id, so it is the same
 * question on every refresh rather than a new one each time the page loads.
 *
 * A report page must not fall over for a nicety, so a template that cannot
 * generate simply contributes no example.
 */
function exampleQuestion(subject: string, topic: string, level: YearLevel): string | null {
  const template = templatesFor(subject, level).find((candidate) => candidate.topic === topic);
  if (!template) return null;

  try {
    return generateQuestion(template, createRng(template.id)).prompt;
  } catch {
    return null;
  }
}

export function ProgressTopics({
  observations,
  sittings,
  subject,
  level,
  now,
  offsetMinutes,
}: {
  observations: Observation[];
  sittings: Sitting[];
  subject: string;
  level: YearLevel | null;
  now: number;
  offsetMinutes: number;
}) {
  const reports = topicReports(observations, now);
  const problems = problemTopics(reports);
  const doingWell = strengths(reports);
  const due = dueForReview(reports);
  const judged = reports.some((report) => report.attempts >= MIN_OBSERVATIONS);
  const breadth = level ? coverage(reports, topicsForLevel(subject, level), level) : null;

  return (
    <section className="space-y-10">
      <div>
        <h2 className="mb-3 text-2xl font-semibold">Needs a hand</h2>
        {!judged ? (
          <Unproven />
        ) : problems.length === 0 ? (
          <p className="text-lg text-(--color-ink-soft)">
            Nothing is going badly at the moment.
          </p>
        ) : (
          <ul className="space-y-3">
            {problems.map((report) => (
              <li
                key={`${report.level}|${report.topic}`}
                className="rounded-3xl border-2 border-(--color-line) bg-(--color-card) p-5"
              >
                <TopicLine report={report} now={now} offsetMinutes={offsetMinutes} />
                {(() => {
                  const example = exampleQuestion(subject, report.topic, report.level);
                  return example ? (
                    <p className="mt-3 rounded-2xl bg-(--color-brand-soft) px-4 py-3 text-lg">
                      Try together: {example}
                    </p>
                  ) : null;
                })()}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div>
        <h2 className="mb-3 text-2xl font-semibold">Doing well</h2>
        {!judged ? (
          <Unproven />
        ) : doingWell.length === 0 ? (
          <p className="text-lg text-(--color-ink-soft)">
            Nothing has been known on enough separate days to call it learned yet.
          </p>
        ) : (
          <ul className="space-y-2">
            {doingWell.map((report) => (
              <li key={`${report.level}|${report.topic}`} className="text-lg">
                <span className="font-semibold capitalize">{report.topic}</span>
                <span className="text-(--color-ink-soft)">
                  {' '}
                  · {yearLabel(report.level)} · known on {report.correctDays} separate day
                  {report.correctDays === 1 ? '' : 's'}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {due.length > 0 ? (
        <div>
          <h2 className="mb-1 text-2xl font-semibold">Coming up for review</h2>
          <p className="mb-3 text-base text-(--color-ink-soft)">
            Known, and left alone long enough to be worth confirming. Learnr will bring these
            back on its own.
          </p>
          <ul className="space-y-2">
            {due.map((report) => (
              <li key={`${report.level}|${report.topic}`} className="text-lg">
                <span className="font-semibold capitalize">{report.topic}</span>
                <span className="text-(--color-ink-soft)"> · {yearLabel(report.level)}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {breadth && level && breadth.offered > 0 ? (
        <div>
          <h2 className="mb-1 text-2xl font-semibold">
            {yearLabel(level)} · {breadth.practised} of {breadth.offered} topics practised
          </h2>
          {breadth.untouched.length > 0 ? (
            <p className="text-lg text-(--color-ink-soft)">
              Not yet tried: {breadth.untouched.join(', ')}.
            </p>
          ) : (
            <p className="text-lg text-(--color-ink-soft)">Every topic this year offers.</p>
          )}
        </div>
      ) : null}

      {sittings.length > 0 ? (
        <div>
          <h2 className="mb-3 text-2xl font-semibold">Recent sittings</h2>
          <ul className="space-y-2">
            {sittings.map((sitting) => (
              <li key={sitting.id} className="text-lg tabular-nums">
                <span className="font-medium">
                  {DATE.format(new Date(sitting.startedAt + offsetMinutes * 60_000))}
                </span>
                <span className="text-(--color-ink-soft)">
                  {' '}
                  · {yearLabel(sitting.level)} · {sitting.attempts} question
                  {sitting.attempts === 1 ? '' : 's'} ·{' '}
                  {Math.round((sitting.correct / sitting.attempts) * 100)}% ·{' '}
                  {Math.max(1, Math.round(sitting.timeMs / 60_000))} min
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}

/** Said in words rather than drawn as an empty list. Not knowing is a real answer. */
function Unproven() {
  return (
    <p className="text-lg text-(--color-ink-soft)">
      Not enough answers yet to say. Learnr waits for {MIN_OBSERVATIONS} answers on a topic
      before it calls anything easy or hard.
    </p>
  );
}

function TopicLine({
  report,
  now,
  offsetMinutes,
}: {
  report: TopicReport;
  now: number;
  offsetMinutes: number;
}) {
  const days = localDay(now, offsetMinutes) - localDay(report.lastAnsweredAt, offsetMinutes);

  return (
    <p className="text-lg">
      <span className="text-xl font-semibold capitalize">{report.topic}</span>
      <span className="text-(--color-ink-soft)">
        {' '}
        · {yearLabel(report.level)} · {Math.round(report.accuracy * 100)}% of {report.attempts}
        {report.trend === 'improving' ? ' · improving' : null}
        {report.trend === 'slipping' ? ' · slipping' : null}
        {' · last practised '}
        {days <= 0 ? 'today' : days === 1 ? 'yesterday' : `${days} days ago`}
      </span>
    </p>
  );
}
