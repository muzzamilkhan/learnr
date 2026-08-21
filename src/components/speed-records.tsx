import { runHistory, type SpeedAttempt } from '@/lib/speedrun/history';
import { modeKey, modeLabel, operationGlyph, operationLabel } from '@/lib/speedrun/modes';
import { OPERATION_ACCENT } from './speed-cards';
import { SpeedTryLink } from './speed-try';
import { StarIcon } from './star-icon';

/**
 * A player's own runs - one collectible card per mode, and inside it the five
 * best runs at that mode, highest first.
 *
 * **The card is the leaderboard's card**, deliberately: the same coloured title
 * bar carrying the whole name ("Add - Easy", "Multiply - 7 times table"), the
 * same foil sheen, the same fixed portrait frame and the same
 * `OPERATION_ACCENT`. The two screens answer neighbouring questions - how the
 * house is going and how *I* am going - and a child moving between them should
 * be reading the same object with a different picture on the front. What was
 * there before was five operation sections of stacked rows, which is the shape
 * the leaderboard was already talked out of.
 *
 * **The picture on the front is a table rather than a podium**, because there
 * is only ever one player on it. A podium of one is a single face with two
 * holes punched beside it, which says nothing; a run of scores says the thing a
 * player actually wants from their own cabinet - whether the best was a fluke
 * or a floor, and whether the runs since are climbing towards it.
 *
 * **The best is bold and wears a star.** It is the number that is really the
 * record - the one `SpeedRecord` keeps, the one the leaderboard ranks and the
 * one a banner announced - and the four beneath it are the context that makes
 * it mean something. Only one row is ever starred, even when a later run
 * matched it: the star marks the run that *set* the best. `runHistory` decides
 * that and is tested there.
 *
 * `history === null` means the read failed, not that nothing has been played -
 * the distinction `readObservations` draws, and getting it backwards here would
 * tell a child with records that they have none. `[]` is the honest "nothing
 * yet", and **only modes that have been run appear**: twenty-six empty tables
 * make a to-do list out of a trophy case. What is missing is not a prompt to go
 * and play - the cards above are, and they are always all five.
 *
 * `scale` follows `Select`'s precedent: `'child'` is large type and targets,
 * the default, since this is chiefly reached from the child's own home screen;
 * `'parent'` is smaller type and single-width borders, for a grown-up reading
 * their own runs at `/progress/speed/records` inside `ParentShell`. A parent
 * reading their *child's* report gets `SpeedTable` instead - a weekly skim is
 * read down a column, and the cards are built for the player.
 */

const DATE = new Intl.DateTimeFormat('en-AU', {
  day: 'numeric',
  month: 'short',
  // `playedAt` is a plain server timestamp, not shifted into a child's local
  // day the way an `Attempt` is - pinning UTC just keeps the server render and
  // any later client one from disagreeing about which side of midnight it fell.
  timeZone: 'UTC',
});

/**
 * The foil, shared with `FamilyLeaderboard` - white at low opacity over the
 * operation's wash, so every card gets a sheen without a per-accent gradient to
 * keep in step with `OPERATION_ACCENT`.
 */
const SHEEN =
  'linear-gradient(115deg, transparent 40%, rgb(255 255 255 / 0.5) 50%, transparent 60%),' +
  'linear-gradient(160deg, rgb(255 255 255 / 0.65), transparent 60%)';

const SCALES = {
  child: {
    grid: 'grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6',
    card: 'flex h-80 flex-col overflow-hidden rounded-2xl border-2 bg-(--color-card) shadow-sm',
    bar: 'flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.4)]',
    glyph: 'text-sm leading-none',
    body: 'relative flex flex-1 flex-col px-3 py-2.5',
    list: 'relative flex flex-1 flex-col',
    row: 'flex items-baseline gap-1.5 py-1 text-base',
    star: 'size-4 shrink-0 self-center text-(--color-star)',
    gap: 'size-4 shrink-0',
    score: 'font-bold tabular-nums',
    date: 'ml-auto text-xs text-(--color-ink-soft) tabular-nums',
    empty: 'text-xl text-(--color-ink-soft)',
  },
  parent: {
    grid: 'grid grid-cols-2 gap-2.5 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6',
    card: 'flex h-64 flex-col overflow-hidden rounded-xl border bg-(--color-card) shadow-sm',
    bar: 'flex items-center gap-1.5 px-2.5 py-1.5 text-[0.65rem] font-bold text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.4)]',
    glyph: 'text-xs leading-none',
    body: 'relative flex flex-1 flex-col px-2.5 py-2',
    list: 'relative flex flex-1 flex-col',
    row: 'flex items-baseline gap-1.5 py-0.5 text-sm',
    star: 'size-3.5 shrink-0 self-center text-(--color-star)',
    gap: 'size-3.5 shrink-0',
    score: 'font-bold tabular-nums',
    date: 'ml-auto text-[0.65rem] text-(--color-ink-soft) tabular-nums',
    empty: 'text-sm text-(--color-ink-soft)',
  },
} as const;

export function SpeedRecordsCabinet({
  attempts,
  basePath = '/speed',
  scale = 'child',
}: {
  /** This player's runs, already cut to the best few per mode. Null means the read failed. */
  attempts: SpeedAttempt[] | null;
  /** Where the Try button goes: `/speed` for a child, `/progress/speed` for a parent. */
  basePath?: string;
  scale?: keyof typeof SCALES;
}) {
  const style = SCALES[scale];

  if (attempts === null) {
    return <p className={style.empty}>Couldn&rsquo;t load records just now. Try again in a moment.</p>;
  }

  const history = runHistory(attempts);

  if (history.length === 0) {
    return (
      <p className={style.empty}>
        No runs yet. Finish one and your scores land here.
      </p>
    );
  }

  return (
    <div className={style.grid}>
      {history.map(({ mode, runs }) => {
        const accent = OPERATION_ACCENT[mode.op];
        // One line, both halves of the name - the leaderboard's title exactly.
        const title = `${operationLabel(mode.op)} - ${modeLabel(mode)}`;
        return (
          <section key={modeKey(mode)} className={`${style.card} ${accent.line}`}>
            <h2 className={`${style.bar} ${accent.solid}`} title={title}>
              <span aria-hidden className={style.glyph}>
                {operationGlyph(mode.op)}
              </span>
              <span className="truncate">{title}</span>
            </h2>
            <div className={`${style.body} ${accent.wash}`}>
              <span aria-hidden className="pointer-events-none absolute inset-0" style={{ backgroundImage: SHEEN }} />
              <ol className={style.list}>
                {runs.map((run) => (
                  <li key={run.playedAt.getTime()} className={style.row}>
                    {run.best ? (
                      <StarIcon filled className={style.star} />
                    ) : (
                      // Held open rather than dropped, so the scores under the
                      // best stay in one column instead of stepping left.
                      <span aria-hidden className={style.gap} />
                    )}
                    <span className={run.best ? `${style.score} ${accent.text}` : style.score}>
                      {run.correct}
                    </span>
                    <span className={style.date}>{DATE.format(run.playedAt)}</span>
                  </li>
                ))}
              </ol>
              <SpeedTryLink mode={mode} basePath={basePath} scale={scale} />
            </div>
          </section>
        );
      })}
    </div>
  );
}
