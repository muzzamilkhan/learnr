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
 * "nothing yet", and modes never run stay in the list rather than being left
 * out of it: greyed out with a dash, so there is visibly something to go
 * after rather than a short list of what is already done.
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

  return (
    <div className={style.stack}>
      {OPERATIONS.map((op) => {
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
              {modesFor(op).map((mode) => {
                const key = modeKey(mode);
                const best = bestByKey.get(key);
                return (
                  <li key={key} className={`${style.row} ${best ? '' : 'opacity-40'}`}>
                    <span className="min-w-0 flex-1 truncate font-medium">{modeLabel(mode)}</span>
                    {best ? (
                      <span className="flex shrink-0 items-baseline gap-2">
                        <span className={style.best}>{best.best}</span>
                        <span className={style.date}>{DATE.format(best.achievedAt)}</span>
                      </span>
                    ) : (
                      <span className={style.date}>-</span>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
