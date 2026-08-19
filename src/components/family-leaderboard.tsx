import { familyStandings, type FamilyRecord, type Place } from '@/lib/speedrun/leaderboard';
import { modeKey, modeLabel, operationGlyph, operationLabel } from '@/lib/speedrun/modes';
import { OPERATION_ACCENT, type Accent } from './speed-cards';
import { CrownIcon } from './crown-icon';
import { ProfileFace } from './profile-face';

/**
 * Who is fastest in the house - one card per mode, ranked as a podium.
 *
 * **A mode is a card, and the podium is the shape of the result.** The board
 * used to be five operation sections of stacked rows, which read as a list of
 * numbers to compare rather than a result to look at: first, second and third
 * were three lines the same size, told apart only by a badge. A podium says the
 * same thing by position - first at the top, second to its left, third a little
 * lower to its right - so who won is read before anything is decoded. The
 * card's own title carries the operation and the mode, which is why the
 * operation headings went with the sections: the card says "Multiply" and "7
 * times table" itself.
 *
 * The ranking itself is `familyStandings`, in `lib` and tested there, because
 * how a tie is placed is exactly the sort of thing that must not be judged only
 * by eye in a component.
 *
 * **A place is a face, not a name.** Scanning a board for yourself is the whole
 * of how it gets read, and a child finds their own photograph faster than their
 * name - the pre-literate child is the reason the avatars exist at all, and a
 * board spelled out in names is the one screen that forgets it. The name is not
 * lost: it is the face's `alt` and `title`, so a hover and a screen reader still
 * say who each place is. A grown-up shows the picture Google gave them, since no
 * parent has an avatar or a cropped photo, and their lettered circle when even
 * that is missing - `ProfileFace` owns that order, here as everywhere else.
 *
 * **The crown sits above the circle, never across it.** It is the one mark that
 * says first place now that the badge is gone, and covering any part of the
 * photograph to draw it would cost the board the thing it is read for.
 *
 * `you` marks the viewer's own places, under the face, and it is the only text
 * on a podium beside the score.
 *
 * **The card wears its operation's colour**, washed across the whole panel with
 * a border and a solid glyph tile to match, rather than tinting the one tile and
 * leaving twenty-seven identical white boxes to be told apart by reading their
 * headings. `OPERATION_ACCENT` is the same table the cards, the cabinet and the
 * result screen use, so Multiply is the same pink here as the card that starts
 * the run - the colour is the mode's name said a second way.
 */

const SCALES = {
  child: {
    grid: 'grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4',
    card: 'rounded-3xl border-2 p-5',
    header: 'flex items-center gap-3',
    tile: 'flex size-10 shrink-0 items-center justify-center rounded-xl text-lg font-bold text-white',
    op: 'text-lg font-semibold leading-tight',
    mode: 'text-base text-(--color-ink-soft) leading-tight',
    podium: 'mt-4',
    winnerFace: 'size-16',
    winnerPx: 64,
    winnerScore: 'text-2xl font-bold tabular-nums',
    face: 'size-12',
    px: 48,
    score: 'text-lg font-bold tabular-nums',
    crown: 'size-7',
    you: 'mt-1 rounded-md bg-(--color-card) px-1.5 py-0.5 text-xs font-semibold text-(--color-ink-soft)',
    empty: 'text-xl text-(--color-ink-soft)',
  },
  parent: {
    grid: 'grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4',
    card: 'rounded-xl border p-4',
    header: 'flex items-center gap-2',
    tile: 'flex size-6 shrink-0 items-center justify-center rounded-md text-xs font-bold text-white',
    op: 'text-sm font-semibold leading-tight',
    mode: 'text-xs text-(--color-ink-soft) leading-tight',
    podium: 'mt-3',
    winnerFace: 'size-12',
    winnerPx: 48,
    winnerScore: 'text-lg font-bold tabular-nums',
    face: 'size-9',
    px: 36,
    score: 'text-sm font-bold tabular-nums',
    crown: 'size-5',
    you: 'mt-0.5 rounded bg-(--color-card) px-1 text-[0.65rem] font-semibold text-(--color-ink-soft)',
    empty: 'text-sm text-(--color-ink-soft)',
  },
} as const;

type Style = (typeof SCALES)[keyof typeof SCALES];

/**
 * One place: the face, the score to its right, and the crown above it when this
 * is a first. The face leads because it is what the board is scanned for - the
 * score is what that face is worth, and it reads as a caption to it.
 */
function Podiumer({
  place,
  you,
  style,
  accent,
}: {
  place: Place;
  you: boolean;
  style: Style;
  accent: Accent;
}) {
  const winner = place.place === 1;

  return (
    <li className="flex flex-col items-center" title={place.playerName}>
      <div className="flex items-center gap-2">
        <span className="relative">
          {winner ? (
            // Above the circle rather than over it, so the photograph stays whole.
            <CrownIcon
              className={`${style.crown} absolute bottom-full left-1/2 -translate-x-1/2 translate-y-1 text-(--color-star)`}
            />
          ) : null}
          <ProfileFace
            photo={place.playerPhoto}
            avatar={place.playerAvatar}
            image={place.playerImage}
            name={place.playerName}
            className={`${winner ? style.winnerFace : style.face} ${winner ? 'ring-2 ring-(--color-star)' : ''}`}
            px={winner ? style.winnerPx : style.px}
          />
        </span>
        <span className={`${winner ? style.winnerScore : style.score} ${winner ? accent.text : 'text-(--color-ink-soft)'}`}>
          {place.best}
        </span>
      </div>
      {you ? <span className={style.you}>you</span> : null}
    </li>
  );
}

/**
 * The triangle: firsts across the top, seconds bottom-left, thirds bottom-right
 * and dropped a little further so the two lower places are not one flat row.
 *
 * Laid out by *place* rather than by position in the list, because a tie shares
 * a place - two firsts belong side by side on the top step, not one of them
 * demoted to the left by the order it happened to be listed in.
 */
function Podium({ places, youId, style, accent }: { places: Place[]; youId?: string; style: Style; accent: Accent }) {
  const tier = (n: number) => places.filter((place) => place.place === n);
  const seconds = tier(2);
  const thirds = tier(3);

  return (
    <div className={style.podium}>
      <ol className="flex flex-wrap items-end justify-center gap-4">
        {tier(1).map((place) => (
          <Podiumer key={place.playerId} place={place} you={place.playerId === youId} style={style} accent={accent} />
        ))}
      </ol>
      {seconds.length > 0 || thirds.length > 0 ? (
        <div className="mt-3 flex items-start justify-between gap-3">
          <ol className="flex gap-3">
            {seconds.map((place) => (
              <Podiumer key={place.playerId} place={place} you={place.playerId === youId} style={style} accent={accent} />
            ))}
          </ol>
          <ol className="mt-4 flex gap-3">
            {thirds.map((place) => (
              <Podiumer key={place.playerId} place={place} you={place.playerId === youId} style={style} accent={accent} />
            ))}
          </ol>
        </div>
      ) : null}
    </div>
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

  return (
    <div className={style.grid}>
      {standings.map((standing) => {
        const accent = OPERATION_ACCENT[standing.mode.op];
        return (
          <section key={modeKey(standing.mode)} className={`${style.card} ${accent.line} ${accent.wash}`}>
            <header className={style.header}>
              <span aria-hidden className={`${style.tile} ${accent.solid}`}>
                {operationGlyph(standing.mode.op)}
              </span>
              <span>
                <h2 className={style.op}>{operationLabel(standing.mode.op)}</h2>
                <p className={style.mode}>{modeLabel(standing.mode)}</p>
              </span>
            </header>
            <Podium places={standing.places} youId={youId} style={style} accent={accent} />
          </section>
        );
      })}
    </div>
  );
}
