import { templatesFor, topicsForLevel } from '@/content/catalog';
import { MIN_OBSERVATIONS, type Observation } from '@/lib/analytics/profile';
import {
  coverage,
  dueForReview,
  problemTopics,
  recentAnswers,
  strengths,
  topicReports,
  type AnsweredQuestion,
  type TopicReport,
} from '@/lib/analytics/report';
import { yearLabel, type YearLevel } from '@/lib/curriculum';
import { localDay } from '@/lib/day';
import type { Sitting } from '@/lib/records';
import { createRng } from '@/lib/rng';
import { generateQuestion } from '@/lib/templates/generate';
import { Diagram } from './diagram';
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
  answered,
  subject,
  level,
  now,
  offsetMinutes,
}: {
  observations: Observation[];
  sittings: Sitting[];
  /**
   * The last few answers on each topic, as they were given. `null` is a failed
   * read, and the panel says so rather than drawing a topic as having no history.
   */
  answered: AnsweredQuestion[] | null;
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
                <WhatHappened
                  answers={answered && recentAnswers(answered, report.topic, report.level)}
                />
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

/**
 * What actually happened, folded away behind a button: the last few questions of
 * a topic that is going badly, each with what the child answered and what it
 * should have been.
 *
 * The percentages above say a topic is hard; only the questions say *how*. Three
 * lines is usually enough to see it - the same sign misread twice, subtraction
 * done the wrong way round, an answer that is right for a question next to this
 * one - which is the difference between a parent knowing to help and knowing
 * what to say.
 *
 * Folded because it is detail, not headline. A weekly skim is the common read
 * and this is the one section a parent opens when they are about to sit down
 * with the child, so it costs a tap and nothing else on the page moves.
 *
 * A plain `<details>`: the disclosure is the whole of the interaction, the rows
 * are rendered with the page, and neither wants a client component. The rows are
 * one line each and elided rather than wrapped - a column of ragged three-line
 * cells is not something you can compare down.
 */
function WhatHappened({ answers }: { answers: AnsweredQuestion[] | null }) {
  if (answers === null) {
    return (
      <p className="mt-2 text-xs text-(--color-ink-soft)">
        Couldn&rsquo;t load the last few questions just now.
      </p>
    );
  }
  if (answers.length === 0) return null;

  return (
    <details className="group mt-2">
      <summary className="no-select inline-flex cursor-pointer list-none items-center gap-1 rounded-lg border border-(--color-line) px-2 py-1 text-xs font-semibold text-(--color-ink-soft) transition hover:bg-(--color-paper) [&::-webkit-details-marker]:hidden">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden
          className="h-3.5 w-3.5 transition group-open:rotate-180"
        >
          <path
            d="M6 9l6 6 6-6"
            stroke="currentColor"
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <span className="group-open:hidden">
          Show the last {answers.length} question{answers.length === 1 ? '' : 's'}
        </span>
        <span className="hidden group-open:inline">Hide the questions</span>
      </summary>

      <table className="mt-2 w-full table-fixed border-collapse text-xs">
        <thead>
          <tr className="text-left text-(--color-ink-soft)">
            <th className="w-1/2 py-1 pr-3 font-medium">Question</th>
            <th className="w-1/4 py-1 pr-3 font-medium">They said</th>
            <th className="w-1/4 py-1 font-medium">Answer</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-(--color-line)">
          {answers.map((answer) => (
            <tr key={`${answer.answeredAt}|${answer.prompt}`}>
              {/* The full text is on the cell, since a line that fits is not a line
                  that always fits and the elision is what keeps the rows comparable.
                  A figure question redraws what the child actually saw - the
                  stored, resolved figure, not a fresh one off today's template -
                  small and at report density (`strokeWidth={1.5}`, per `diagram.tsx`),
                  beside the prompt it was the caption for. Rows with no figure are
                  unchanged. */}
              <td className="py-1.5 pr-3" title={answer.prompt}>
                <div className="flex items-center gap-2">
                  {answer.figure ? (
                    <Diagram
                      figure={answer.figure}
                      strokeWidth={1.5}
                      labelSize={16}
                      className="h-16 w-16 shrink-0 rounded-xl border border-(--color-line) bg-(--color-paper)"
                    />
                  ) : null}
                  <span className="min-w-0 truncate">{answer.prompt}</span>
                </div>
              </td>
              <td
                className={`truncate py-1.5 pr-3 font-semibold ${
                  answer.correct ? 'text-(--color-right)' : 'text-(--color-wrong)'
                }`}
                title={answer.response}
              >
                {/* An answer given as nothing is a question walked away from,
                    which is worth seeing rather than showing as a blank cell. */}
                {answer.response === '' ? 'nothing' : answer.response}
              </td>
              <td className="truncate py-1.5" title={answer.expected}>
                {answer.expected}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </details>
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
