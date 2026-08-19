import { familyStandings, type FamilyRecord, type Place } from '@/lib/speedrun/leaderboard';
import { modeKey, modeLabel, operationGlyph, operationLabel, OPERATIONS } from '@/lib/speedrun/modes';
import { OPERATION_ACCENT } from './speed-cards';

/**
 * Who is fastest in the house, per mode - first, second and third.
 *
 * Built from `SpeedRecordsCabinet`'s shape and its rules: grouped by operation
 * with the same accents, only what has actually been run, `null` for a failed
 * read and `[]` for an honest nothing. What it adds is everyone else in the
 * household on the same row, which is the whole point of it - a personal best
 * says how you did, and this says who to chase.
 *
 * The ranking itself is `familyStandings`, in `lib` and tested there, because
 * how a tie is placed is exactly the sort of thing that must not be judged only
 * by eye in a component.
 *
 * `you` marks the viewer's own places. A child scanning for their own name is
 * the common read, and by the time three names are on a row the fastest way to
 * find yourself is a mark rather than the spelling.
 */

const SCALES = {
  child: {
    stack: 'flex flex-col gap-5',
    section: 'rounded-3xl border-2 border-(--color-line) bg-(--color-card) p-5',
    heading: 'flex items-center gap-3 text-2xl font-semibold',
    tile: 'flex size-10 shrink-0 items-center justify-center rounded-xl text-lg font-bold',
    list: 'mt-2 divide-y divide-(--color-line)',
    mode: 'py-3',
    modeLabel: 'text-xl font-medium',
    places: 'mt-1.5 flex flex-col gap-1',
    place: 'flex items-center gap-3 text-lg',
    badge: 'flex size-7 shrink-0 items-center justify-center rounded-lg text-sm font-bold tabular-nums',
    you: 'rounded-md bg-(--color-brand-soft) px-1.5 py-0.5 text-sm font-semibold text-(--color-brand)',
    best: 'ml-auto shrink-0 font-bold tabular-nums',
    empty: 'text-xl text-(--color-ink-soft)',
  },
  parent: {
    stack: 'flex flex-col gap-3',
    section: 'rounded-xl border border-(--color-line) bg-(--color-card) p-4',
    heading: 'flex items-center gap-2 text-base font-semibold',
    tile: 'flex size-6 shrink-0 items-center justify-center rounded-md text-xs font-bold',
    list: 'mt-1 divide-y divide-(--color-line)',
    mode: 'py-2',
    modeLabel: 'text-sm font-medium',
    places: 'mt-1 flex flex-col gap-0.5',
    place: 'flex items-center gap-2 text-sm',
    badge: 'flex size-5 shrink-0 items-center justify-center rounded text-xs font-bold tabular-nums',
    you: 'rounded bg-(--color-brand-soft) px-1 text-xs font-semibold text-(--color-brand)',
    best: 'ml-auto shrink-0 font-semibold tabular-nums',
    empty: 'text-sm text-(--color-ink-soft)',
  },
} as const;

/**
 * First carries the star tokens the round rewards and the streak already use, so
 * the top of a board is the colour a player recognises as winning; second and
 * third are plain, because three coloured badges would rank nothing.
 */
function badgeTone(place: number): string {
  return place === 1
    ? 'bg-(--color-star-soft) text-(--color-star)'
    : 'bg-(--color-paper) text-(--color-ink-soft)';
}

function PlaceRow({ place, you, style }: { place: Place; you: boolean; style: (typeof SCALES)[keyof typeof SCALES] }) {
  return (
    <li className={style.place}>
      <span className={`${style.badge} ${badgeTone(place.place)}`}>{place.place}</span>
      <span className="min-w-0 truncate">{place.playerName}</span>
      {you ? <span className={style.you}>you</span> : null}
      <span className={style.best}>{place.best}</span>
    </li>
  );
}

export function FamilyLeaderboard({
  records,
  youId,
  scale = 'child',
}: {
  /** Every household member's bests. Null means the read failed. */
  records: FamilyRecord[] | null;
  /** The viewer, so their own places can be marked. */
  youId?: string;
  scale?: keyof typeof SCALES;
}) {
  const style = SCALES[scale];

  if (records === null) {
    return (
      <p className={style.empty}>Couldn&rsquo;t load the leaderboard just now. Try again in a moment.</p>
    );
  }

  const standings = familyStandings(records);

  if (standings.length === 0) {
    return (
      <p className={style.empty}>
        No runs yet. Finish one and your family&rsquo;s scores land here.
      </p>
    );
  }

  // Grouped into the five operations before rendering, so an operation nobody
  // has run drops out with its heading rather than leaving an empty list.
  const sections = OPERATIONS.map((op) => ({
    op,
    standings: standings.filter((standing) => standing.mode.op === op),
  })).filter((section) => section.standings.length > 0);

  return (
    <div className={style.stack}>
      {sections.map(({ op, standings: rows }) => {
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
              {rows.map((standing) => (
                <li key={modeKey(standing.mode)} className={style.mode}>
                  <p className={style.modeLabel}>{modeLabel(standing.mode)}</p>
                  <ol className={style.places}>
                    {standing.places.map((place) => (
                      <PlaceRow
                        key={place.playerId}
                        place={place}
                        you={place.playerId === youId}
                        style={style}
                      />
                    ))}
                  </ol>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
