import { speedSummaries, type Change, type SummaryRun } from '@/lib/speedrun/summary';
import { modeKey, modeLabel, operationGlyph, operationLabel } from '@/lib/speedrun/modes';
import { OPERATION_ACCENT } from './speed-cards';

/**
 * A child's speed runs on their parent's report: one row a mode, the best they
 * have done at it, the run they last played, and which way that moved.
 *
 * **A table rather than the cabinet's cards.** The cards are collectibles - a
 * coloured frame, a foil sheen and a starred best - and they are built for the
 * player, who reads a wall of them by colour the way they read a wall of cards.
 * A parent skimming a weekly report is reading down a column instead: which
 * modes have been played lately, how they are going, and whether last week was
 * better than this one. Twenty-seven portrait frames are the wrong shape for
 * that question, and the child's own trophy screen keeps them precisely because
 * it is the right shape for theirs.
 *
 * **The latest run is the number in the middle, not the best.** A best cannot
 * fall, so a table of bests says nothing about the last fortnight - it is a
 * high-water mark and reads the same whether a child has improved, plateaued or
 * stopped. The best stays as the standing figure, and the run beside it is the
 * one that just happened, with the change since the run before it. That change
 * is what a parent is actually reading the row for.
 *
 * **Ordered by when a mode was last played**, freshest at the top, so the modes
 * a child is actually working on are the ones read first - the leaderboard's
 * rule and the cabinet's, for their reason. Twenty-seven rows is more than
 * anybody reads top to bottom.
 *
 * `null` means the read failed, `[]` means nothing has been run - the
 * distinction `readObservations` draws, and rendering the first as the second
 * would tell a parent their child has never played.
 */

const DATE = new Intl.DateTimeFormat('en-AU', {
  day: 'numeric',
  month: 'short',
  // `playedAt` is a plain server timestamp, not shifted into the child's local
  // day the way an `Attempt` is - pinning UTC keeps the server render and any
  // later client one from disagreeing about which side of midnight it fell.
  timeZone: 'UTC',
});

export function SpeedTable({ runs }: { runs: SummaryRun[] | null }) {
  if (runs === null) {
    return (
      <p className="text-sm text-(--color-ink-soft)">
        Couldn&rsquo;t load speed runs just now. Try again in a moment.
      </p>
    );
  }

  const summaries = speedSummaries(runs);

  if (summaries.length === 0) {
    return <p className="text-sm text-(--color-ink-soft)">No speed runs yet.</p>;
  }

  // Narrow-aware rather than scrolling sideways: a phone drops the date column,
  // which is the one thing on the row the order above it already says, and
  // keeps the three numbers the row is actually read for.
  return (
    <table className="w-full table-fixed border-collapse text-xs sm:text-sm">
      <thead>
        <tr className="text-left text-xs text-(--color-ink-soft)">
          <th className="w-2/5 py-1 pr-2 font-medium sm:pr-3">Mode</th>
          <th className="py-1 pr-2 text-right font-medium sm:pr-3">Best</th>
          <th className="py-1 pr-2 text-right font-medium sm:pr-3">Latest</th>
          <th className="py-1 text-right font-medium sm:pr-3">Change</th>
          <th className="hidden py-1 text-right font-medium sm:table-cell">Played</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-(--color-line)">
        {summaries.map(({ mode, best, latest, change }) => {
          const accent = OPERATION_ACCENT[mode.op];
          const name = `${operationLabel(mode.op)} - ${modeLabel(mode)}`;
          return (
            <tr key={modeKey(mode)}>
              {/* The full name is on the cell, since a name that fits at one
                  width is not a name that fits at every width. */}
              <td className="truncate py-1.5 pr-2 sm:pr-3" title={name}>
                <span aria-hidden className={`mr-1.5 text-xs ${accent.text}`}>
                  {operationGlyph(mode.op)}
                </span>
                {name}
              </td>
              <td className="py-1.5 pr-2 text-right font-semibold tabular-nums sm:pr-3">{best}</td>
              {/* Just the score. A run only moves on a right answer, so there
                  is no count of questions attempted to put beside it - "8 of
                  20" was the reading that made a bare 8 ambiguous, and there is
                  no longer an 8 out of anything but 8. */}
              <td className="py-1.5 pr-2 text-right font-semibold tabular-nums sm:pr-3">
                {latest.correct}
              </td>
              <td className="py-1.5 text-right tabular-nums sm:pr-3">
                <ChangeCell change={change} />
              </td>
              <td className="hidden py-1.5 text-right text-xs text-(--color-ink-soft) tabular-nums sm:table-cell">
                {DATE.format(latest.playedAt)}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

/**
 * How the latest run compares with the one before it.
 *
 * A first run has nothing to compare against and gets an em dash rather than a
 * zero: no change and no previous run are different things, and a 0% against a
 * first-ever run reads as a child who went nowhere.
 *
 * A percentage needs a previous score above nought to divide by, so a run
 * following a blank one shows the count it gained instead. It is the only
 * honest thing to put there, and it is rare enough not to be worth a column of
 * its own.
 */
function ChangeCell({ change }: { change: Change | null }) {
  if (change === null) return <span className="text-(--color-ink-soft)">&mdash;</span>;
  if (change.delta === 0) return <span className="text-(--color-ink-soft)">&mdash;</span>;

  const up = change.delta > 0;
  const size =
    change.percent === null
      ? `${up ? '+' : ''}${change.delta}`
      : `${Math.abs(change.percent)}%`;

  return (
    <span className={up ? 'text-(--color-right)' : 'text-(--color-wrong)'}>
      <span aria-hidden>{up ? '▲' : '▼'} </span>
      <span className="sr-only">{up ? 'up ' : 'down '}</span>
      {size}
    </span>
  );
}
