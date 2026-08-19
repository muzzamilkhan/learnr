import type { SpeedBest } from '@/lib/speed-records';
import { modeKey, modeLabel, modesFor, operationGlyph, operationLabel, OPERATIONS } from '@/lib/speedrun/modes';
import { OPERATION_ACCENT } from './speed-cards';

/**
 * Every mode this player could run, grouped by operation, with the best
 * scored on each and when.
 *
 * `bests === null` means the read failed, not that nothing has been played -
 * the distinction `readObservations` draws, and getting it backwards here
 * would tell a child who has records that they have none. `[]` is the honest
 * "nothing yet".
 *
 * **Only what has been run is listed.** A mode never played has no record to
 * show, and twenty-seven rows of dashes is a to-do list rather than a cabinet -
 * the four or five scores actually set were the smallest thing on a screen
 * mostly made of what had not happened. An operation with nothing under it
 * loses its whole section for the same reason. What is missing is not a
 * prompt to go and play: the cards above are, and they are always all five.
 *
 * `scale` follows `Select`'s precedent: `'child'` is large type and targets,
 * the default, since this is chiefly reached from the child's own home
 * screen; `'parent'` is `text-sm`/`rounded-xl`/single-width borders for a
 * later screen that embeds it in a report.
 */

const DATE = new Intl.DateTimeFormat('en-AU', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  // `achievedAt` is a plain server timestamp, not shifted into a child's local
  // day the way an `Attempt` is - pinning UTC just keeps the server render and
  // any later client one from disagreeing about which side of midnight it fell.
  timeZone: 'UTC',
});

const SCALES = {
  child: {
    stack: 'flex flex-col gap-5',
    section: 'rounded-3xl border-2 border-(--color-line) bg-(--color-card) p-5',
    heading: 'flex items-center gap-3 text-2xl font-semibold',
    tile: 'flex size-10 shrink-0 items-center justify-center rounded-xl text-lg font-bold',
    list: 'mt-2 divide-y divide-(--color-line)',
    row: 'flex items-center justify-between gap-3 py-2.5 text-xl',
    best: 'text-xl font-bold tabular-nums',
    date: 'text-base text-(--color-ink-soft) tabular-nums',
    empty: 'text-xl text-(--color-ink-soft)',
  },
  parent: {
    stack: 'flex flex-col gap-3',
    section: 'rounded-xl border border-(--color-line) bg-(--color-card) p-4',
    heading: 'flex items-center gap-2 text-base font-semibold',
    tile: 'flex size-6 shrink-0 items-center justify-center rounded-md text-xs font-bold',
    list: 'mt-1 divide-y divide-(--color-line)',
    row: 'flex items-center justify-between gap-3 py-1.5 text-sm',
    best: 'text-sm font-semibold tabular-nums',
    date: 'text-xs text-(--color-ink-soft) tabular-nums',
    empty: 'text-sm text-(--color-ink-soft)',
  },
} as const;

export function SpeedRecordsCabinet({
  bests,
  scale = 'child',
}: {
  bests: SpeedBest[] | null;
  scale?: 'child' | 'parent';
}) {
  const style = SCALES[scale];

  if (bests === null) {
    return <p className={style.empty}>Couldn&rsquo;t load records just now. Try again in a moment.</p>;
  }

  const bestByKey = new Map(bests.map((best) => [best.mode, best]));

  // Each operation with the modes actually run under it, in `MODES` order.
  // Built before rendering rather than filtered inside the map, so an
  // operation with nothing under it can drop out entirely instead of leaving
  // a heading over an empty list.
  const sections = OPERATIONS.map((op) => ({
    op,
    rows: modesFor(op).flatMap((mode) => {
      const best = bestByKey.get(modeKey(mode));
      return best ? [{ mode, best }] : [];
    }),
  })).filter((section) => section.rows.length > 0);

  if (sections.length === 0) {
    return (
      <p className={style.empty}>
        No runs yet. Finish one and the best score lands here.
      </p>
    );
  }

  return (
    <div className={style.stack}>
      {sections.map(({ op, rows }) => {
        const accent = OPERATION_ACCENT[op];
        return (
          <section key={op} className={style.section}>
            <h2 className={style.heading}>
              <span aria-hidden className={`${style.tile} ${accent.tile}`}>
                {operationGlyph(op)}
              </span>
              {operationLabel(op)}
            </h2>
            <ul className={style.list}>
              {rows.map(({ mode, best }) => (
                <li key={modeKey(mode)} className={style.row}>
                  <span className="min-w-0 flex-1 truncate font-medium">{modeLabel(mode)}</span>
                  <span className="flex shrink-0 items-baseline gap-2">
                    <span className={style.best}>{best.best}</span>
                    <span className={style.date}>{DATE.format(best.achievedAt)}</span>
                  </span>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
