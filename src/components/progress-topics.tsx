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
import { Well } from './well';

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
    <section className="space-y-4">
      <Well title="Needs a hand">
        {!judged ? (
          <Unproven />
        ) : problems.length === 0 ? (
          <p className="text-sm text-(--color-ink-soft)">
            Nothing is going badly at the moment.
          </p>
        ) : (
          // Divided rather than boxed: a card inside a well reads as double-boxed.
          <ul className="divide-y divide-(--color-line)">
            {problems.map((report) => (
              <li key={`${report.level}|${report.topic}`} className="py-3 first:pt-0 last:pb-0">
                <TopicLine report={report} now={now} offsetMinutes={offsetMinutes} />
                {(() => {
                  const example = exampleQuestion(subject, report.topic, report.level);
                  return example ? (
                    <p className="mt-2 rounded-lg bg-(--color-brand-soft) px-3 py-2 text-sm">
                      Try together: {example}
                    </p>
                  ) : null;
                })()}
              </li>
            ))}
          </ul>
        )}
      </Well>

      <Well title="Doing well">
        {!judged ? (
          <Unproven />
        ) : doingWell.length === 0 ? (
          <p className="text-sm text-(--color-ink-soft)">
            Nothing has been known on enough separate days to call it learned yet.
          </p>
        ) : (
          <ul className="space-y-1">
            {doingWell.map((report) => (
              <li key={`${report.level}|${report.topic}`} className="text-sm">
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
      </Well>

      {due.length > 0 ? (
        <Well
          title="Coming up for review"
          note="Known, and left alone long enough to be worth confirming. LearnR will bring these back on its own."
        >
          <ul className="space-y-1">
            {due.map((report) => (
              <li key={`${report.level}|${report.topic}`} className="text-sm">
                <span className="font-semibold capitalize">{report.topic}</span>
                <span className="text-(--color-ink-soft)"> · {yearLabel(report.level)}</span>
              </li>
            ))}
          </ul>
        </Well>
      ) : null}

      {breadth && level && breadth.offered > 0 ? (
        <Well
          title={`${yearLabel(level)} topics`}
          aside={`${breadth.practised} of ${breadth.offered} practised`}
        >
          {breadth.untouched.length > 0 ? (
            <p className="text-sm text-(--color-ink-soft)">
              Not yet tried: {breadth.untouched.join(', ')}.
            </p>
          ) : (
            <p className="text-sm text-(--color-ink-soft)">Every topic this year offers.</p>
          )}
        </Well>
      ) : null}

      {sittings.length > 0 ? (
        <Well title="Recent sittings">
          <ul className="space-y-1">
            {sittings.map((sitting) => (
              <li key={sitting.id} className="text-sm tabular-nums">
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
        </Well>
      ) : null}
    </section>
  );
}

/** Said in words rather than drawn as an empty list. Not knowing is a real answer. */
function Unproven() {
  return (
    <p className="text-sm text-(--color-ink-soft)">
      Not enough answers yet to say. LearnR waits for {MIN_OBSERVATIONS} answers on a topic
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
    <p className="text-sm">
      <span className="text-base font-semibold capitalize">{report.topic}</span>
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
