import { shortYearLabel } from '@/lib/curriculum';
import {
  classifiedShare,
  classifyError,
  errorClusters,
  ERROR_ADVICE,
  ERROR_LABELS,
} from '@/lib/analytics/errors';
import {
  blindSpots,
  levelFit,
  templateReports,
  type AnsweredQuestion,
  type LevelVerdict,
} from '@/lib/analytics/report';
import type { Observation } from '@/lib/analytics/profile';
import { Well } from '@/components/well';

/**
 * The workbench for three reads that are not on the parent's report yet.
 *
 * It exists to be judged rather than read: each section shows what the new
 * function concluded *and* enough of what it ran on to tell whether the
 * conclusion is any good. That is the whole reason it is a screen of its own
 * rather than three more wells on `/progress` - a finding that turns out to be
 * wrong should cost nothing to delete, and it can only cost nothing while no
 * parent has been shown it.
 *
 * Nothing here writes, and nothing here is read by anything that decides what a
 * child is asked next.
 */
export function ProgressLab({
  observations,
  answered,
  childName,
}: {
  observations: readonly Observation[];
  answered: readonly AnsweredQuestion[];
  childName: string;
}) {
  const fit = levelFit(observations);
  const templates = templateReports(observations);
  const blind = blindSpots(templates);
  const clusters = errorClusters(answered);
  const share = classifiedShare(answered);
  const unclassified = answered.filter(
    (answer) => !answer.correct && classifyError(answer) === null,
  );

  return (
    <div className="space-y-4">
      <p className="rounded-xl border border-dashed border-(--color-line) bg-(--color-card) p-3 text-sm text-(--color-ink-soft)">
        <span className="font-semibold text-(--color-ink)">Not the report.</span> Three reads being
        tried out on {childName}&rsquo;s history before any of them earn a place on it. Every
        section shows its working, because the point is to decide whether it is worth believing.
      </p>

      <Well
        title="Is the level pitched right?"
        note="Around three in four right is the mixing working. Well under that is a level asking more than it is teaching."
      >
        {fit.length === 0 ? (
          <Empty>Nothing answered yet.</Empty>
        ) : (
          <ul className="divide-y divide-(--color-line)">
            {fit.map((entry) => (
              <li key={entry.level} className="flex items-baseline justify-between gap-4 py-2">
                <span className="font-semibold">{shortYearLabel(entry.level)}</span>
                <span className="flex items-baseline gap-3 text-sm">
                  <span className="text-(--color-ink-soft)">
                    {entry.correct} of {entry.attempts} right
                  </span>
                  <span className="tabular-nums">{Math.round(entry.accuracy * 100)}%</span>
                  <Verdict verdict={entry.verdict} />
                </span>
              </li>
            ))}
          </ul>
        )}
      </Well>

      <Well
        title="What a topic average is hiding"
        note="A single template running far below the topic around it - the thing a topic bar cannot show."
        aside={
          <span className="tabular-nums">
            {templates.filter((report) => report.correct === 0).length} of {templates.length}{' '}
            templates never once right
          </span>
        }
      >
        {blind.length === 0 ? (
          <Empty>
            Nothing here - which is a finding rather than a gap. A template only shows up when the
            topic around it is going better than it is, so a topic asked by a single template can
            never produce one: there is no average for it to hide behind, and{' '}
            <span className="whitespace-nowrap">&ldquo;Needs a hand&rdquo;</span> on the report
            already names it. The table below is the read that pays either way.
          </Empty>
        ) : (
          <ul className="divide-y divide-(--color-line)">
            {blind.map((spot) => (
              <li key={spot.templateId} className="py-2">
                <div className="flex items-baseline justify-between gap-4">
                  <span className="truncate font-mono text-sm">{spot.templateId}</span>
                  <span className="shrink-0 text-sm tabular-nums text-(--color-wrong)">
                    {spot.correct}/{spot.attempts}
                  </span>
                </div>
                <p className="mt-0.5 text-sm text-(--color-ink-soft)">
                  {Math.round(spot.accuracy * 100)}% on this question, against{' '}
                  {Math.round(spot.topicAccuracy * 100)}% across {spot.topic} at{' '}
                  {shortYearLabel(spot.level)}.
                </p>
              </li>
            ))}
          </ul>
        )}

        <details className="mt-3">
          <summary className="cursor-pointer text-sm font-semibold text-(--color-ink-soft)">
            Every template, worst first ({templates.length})
          </summary>
          <Table
            head={['Template', 'Right', 'Attempts', 'Avg time']}
            rows={templates.map((report) => [
              <span key="id" className="font-mono text-xs">
                {report.templateId}
              </span>,
              `${Math.round(report.accuracy * 100)}%`,
              String(report.attempts),
              `${Math.round(report.averageTimeMs / 1000)}s`,
            ])}
          />
        </details>
      </Well>

      <Well
        title="The same mistake, across topics"
        note="Grouped by what went wrong rather than by which topic it went wrong in - one misconception can live in three topic rows and be invisible in all of them."
        aside={
          <span className="tabular-nums">
            {share.classified} of {share.wrong} wrong answers named
            {share.wrong > 0 ? ` (${Math.round((share.classified / share.wrong) * 100)}%)` : null}
          </span>
        }
      >
        {clusters.length === 0 ? (
          <Empty>No mistake turned up often enough to be a pattern.</Empty>
        ) : (
          <ul className="divide-y divide-(--color-line)">
            {clusters.map((cluster) => (
              <li key={cluster.kind} className="py-3 first:pt-0 last:pb-0">
                <div className="flex items-baseline justify-between gap-4">
                  <span className="font-semibold">{ERROR_LABELS[cluster.kind]}</span>
                  <span className="shrink-0 text-sm tabular-nums text-(--color-ink-soft)">
                    {cluster.count}×
                  </span>
                </div>
                <p className="mt-0.5 text-sm text-(--color-ink-soft)">
                  {ERROR_ADVICE[cluster.kind]}
                </p>
                <p className="mt-1 text-xs text-(--color-ink-soft)">
                  In{' '}
                  {cluster.topics
                    .map((where) => `${where.topic} (${shortYearLabel(where.level)})`)
                    .join(', ')}
                </p>
                <Table
                  head={['Question', 'Answered', 'Should have been']}
                  rows={cluster.examples.map((example) => [
                    example.prompt,
                    <span key="got" className="text-(--color-wrong)">
                      {example.response}
                    </span>,
                    <span key="exp" className="text-(--color-right)">
                      {example.expected}
                    </span>,
                  ])}
                />
              </li>
            ))}
          </ul>
        )}

        <details className="mt-3">
          <summary className="cursor-pointer text-sm font-semibold text-(--color-ink-soft)">
            The {unclassified.length} it could not name
          </summary>
          <p className="mt-1 text-sm text-(--color-ink-soft)">
            The honest half of the idea. A classifier that explained every wrong answer would be
            guessing at some of them, and a guess printed beside a child&rsquo;s name reads exactly
            as confidently as a finding. These are the ones worth reading for a rule worth adding.
          </p>
          <Table
            head={['Question', 'Answered', 'Should have been', 'Topic']}
            rows={unclassified.map((answer) => [
              answer.prompt,
              <span key="got" className="text-(--color-wrong)">
                {answer.response}
              </span>,
              <span key="exp" className="text-(--color-right)">
                {answer.expected}
              </span>,
              `${answer.topic} (${shortYearLabel(answer.level)})`,
            ])}
          />
        </details>
      </Well>
    </div>
  );
}

const VERDICTS: Record<LevelVerdict, { label: string; className: string }> = {
  'too-hard': { label: 'Too hard', className: 'bg-(--color-wrong)/10 text-(--color-wrong)' },
  'about-right': { label: 'About right', className: 'bg-(--color-right)/10 text-(--color-right)' },
  'too-easy': { label: 'Too easy', className: 'bg-(--color-brand)/10 text-(--color-brand)' },
  unknown: { label: 'Too few to say', className: 'bg-(--color-line)/40 text-(--color-ink-soft)' },
};

function Verdict({ verdict }: { verdict: LevelVerdict }) {
  const { label, className } = VERDICTS[verdict];
  return (
    <span className={`rounded-md px-2 py-0.5 text-xs font-semibold ${className}`}>{label}</span>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-(--color-ink-soft)">{children}</p>;
}

/**
 * The working, rather than the finding. Wide by nature - a prompt is a whole
 * sentence - so it scrolls inside its own box rather than pushing the page
 * sideways, the same rule the report's charts follow.
 */
function Table({ head, rows }: { head: string[]; rows: React.ReactNode[][] }) {
  if (rows.length === 0) return null;

  return (
    <div className="mt-2 overflow-x-auto">
      <table className="w-full min-w-[32rem] text-left text-sm">
        <thead>
          <tr className="text-xs text-(--color-ink-soft)">
            {head.map((cell) => (
              <th key={cell} className="py-1 pr-3 font-medium">
                {cell}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-(--color-line)">
          {rows.map((row, index) => (
            <tr key={index}>
              {row.map((cell, column) => (
                <td key={column} className="py-1 pr-3 align-top">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
