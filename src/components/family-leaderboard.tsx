import { familyStandings, type FamilyRecord, type Place } from '@/lib/speedrun/leaderboard';
import { modeKey, modeLabel, operationGlyph, operationLabel } from '@/lib/speedrun/modes';
import { OPERATION_ACCENT, type Accent } from './speed-cards';
import { CrownIcon } from './crown-icon';
import { ProfileFace } from './profile-face';

/**
 * Who is fastest in the house - one collectible card per mode, ranked as a
 * podium.
 *
 * **A mode is a card, and the podium is the shape of the result.** The board
 * used to be five operation sections of stacked rows, which read as a list of
 * numbers to compare rather than a result to look at: first, second and third
 * were three lines the same size, told apart only by a badge. A podium says the
 * same thing by position - first at the top, second below it to the left, third
 * lower again to the right - so who won is read before anything is decoded.
 *
 * **It is drawn as a collectible card because that is what it is**: one per
 * mode, twenty-seven of them, each a fixed frame with a face on the front that
 * changes when somebody beats it. The parts are a trading card's parts - a
 * coloured title bar naming the operation, the mode as its subtitle, and the
 * podium as the picture in the middle - and a child reads a wall of them the
 * way they read a wall of cards, by colour and by who is on the front. The tall
 * portrait frame is what makes that legible: a podium needs the height more
 * than the width, and a card wider than it is tall is a row wearing a border.
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
 * **The crown sits above the circle and the score beneath it, never across
 * it.** Both are captions to the face rather than competition for it: the crown
 * says which one won and the number says what it took, and neither may cover
 * the picture that says who.
 *
 * **The card wears its operation's colour** - `OPERATION_ACCENT`, the same
 * table the cards, the cabinet and the result screen use - so Multiply is the
 * same pink here as the card that starts the run, and twenty-seven cards are
 * told apart at a glance rather than by reading their titles.
 *
 * **Every card is the same fixed height.** A grid row already stretches its
 * cards to match each other, so without a height a card whose mode label
 * wrapped set the height of the five beside it and the next row came out a
 * different size. The podium centres in what the title leaves, so a mode with
 * one place and a mode with three are the same card with a different amount on
 * it.
 */

const SCALES = {
  child: {
    grid: 'grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6',
    card: 'flex h-64 flex-col overflow-hidden rounded-2xl border-2 bg-(--color-card) shadow-sm',
    bar: 'flex items-center gap-1.5 px-2.5 py-1.5 text-sm font-bold text-white',
    glyph: 'text-base leading-none',
    op: 'truncate',
    body: 'flex flex-1 flex-col px-2 py-2.5',
    mode: 'line-clamp-2 text-center text-xs leading-tight font-medium text-(--color-ink-soft)',
    podium: 'flex flex-1 flex-col justify-center pt-3',
    winnerFace: 'size-14',
    winnerPx: 56,
    winnerScore: 'mt-1 text-lg leading-none font-bold tabular-nums',
    face: 'size-10',
    px: 40,
    score: 'mt-1 text-sm leading-none font-bold tabular-nums text-(--color-ink-soft)',
    crown: 'size-6',
    empty: 'text-xl text-(--color-ink-soft)',
  },
  parent: {
    grid: 'grid grid-cols-2 gap-2.5 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6',
    card: 'flex h-56 flex-col overflow-hidden rounded-xl border bg-(--color-card) shadow-sm',
    bar: 'flex items-center gap-1.5 px-2 py-1 text-xs font-bold text-white',
    glyph: 'text-sm leading-none',
    op: 'truncate',
    body: 'flex flex-1 flex-col px-1.5 py-2',
    mode: 'line-clamp-2 text-center text-[0.65rem] leading-tight font-medium text-(--color-ink-soft)',
    podium: 'flex flex-1 flex-col justify-center pt-2.5',
    winnerFace: 'size-12',
    winnerPx: 48,
    winnerScore: 'mt-1 text-base leading-none font-bold tabular-nums',
    face: 'size-9',
    px: 36,
    score: 'mt-1 text-xs leading-none font-bold tabular-nums text-(--color-ink-soft)',
    crown: 'size-5',
    empty: 'text-sm text-(--color-ink-soft)',
  },
} as const;

type Style = (typeof SCALES)[keyof typeof SCALES];

/** One place: the crown above, the face, and the score beneath it. */
function Podiumer({ place, style, accent }: { place: Place; style: Style; accent: Accent }) {
  const winner = place.place === 1;

  return (
    <li className="flex flex-col items-center" title={place.playerName}>
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
      <span className={winner ? `${style.winnerScore} ${accent.text}` : style.score}>{place.best}</span>
    </li>
  );
}

/**
 * A place nobody holds yet: the circle, dashed and empty.
 *
 * Drawn rather than left out, because the podium is the card's picture and a
 * card missing a third of it reads as a card that has not loaded. Dashed says
 * what a gap says - this is a place, and it is open - which is the honest
 * reading of a mode only one person in the house has run, and a better
 * invitation than the absence was.
 */
function EmptyPlace({ style }: { style: Style }) {
  return (
    <li aria-hidden className="flex flex-col items-center">
      <span
        className={`${style.face} shrink-0 rounded-full border-2 border-dashed border-(--color-line)`}
      />
    </li>
  );
}

/**
 * The triangle: firsts across the top, seconds below to the left, thirds lower
 * again to the right, so no two of the three ever sit on one line.
 *
 * Laid out by *place* rather than by position in the list, because a tie shares
 * a place - two firsts belong side by side on the top step, not one of them
 * demoted to the left by the order it happened to be listed in.
 */
function Podium({ places, style, accent }: { places: Place[]; style: Style; accent: Accent }) {
  const tier = (n: number) => places.filter((place) => place.place === n);
  const seconds = tier(2);
  const thirds = tier(3);

  return (
    <div className={style.podium}>
      <ol className="flex flex-wrap items-end justify-center gap-2">
        {tier(1).map((place) => (
          <Podiumer key={place.playerId} place={place} style={style} accent={accent} />
        ))}
      </ol>
      <div className="flex items-start justify-between gap-1">
        <ol className="-mt-1 flex gap-2">
          {seconds.length > 0 ? (
            seconds.map((place) => (
              <Podiumer key={place.playerId} place={place} style={style} accent={accent} />
            ))
          ) : (
            <EmptyPlace style={style} />
          )}
        </ol>
        <ol className="mt-4 flex gap-2">
          {thirds.length > 0 ? (
            thirds.map((place) => (
              <Podiumer key={place.playerId} place={place} style={style} accent={accent} />
            ))
          ) : (
            <EmptyPlace style={style} />
          )}
        </ol>
      </div>
    </div>
  );
}

export function FamilyLeaderboard({
  records,
  scale = 'child',
}: {
  /** Every household member's bests. Null means the read failed. */
  records: FamilyRecord[] | null;
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
          <section key={modeKey(standing.mode)} className={`${style.card} ${accent.line}`}>
            <h2 className={`${style.bar} ${accent.solid}`}>
              <span aria-hidden className={style.glyph}>
                {operationGlyph(standing.mode.op)}
              </span>
              <span className={style.op}>{operationLabel(standing.mode.op)}</span>
            </h2>
            <div className={`${style.body} ${accent.wash}`}>
              <p className={style.mode}>{modeLabel(standing.mode)}</p>
              <Podium places={standing.places} style={style} accent={accent} />
            </div>
          </section>
        );
      })}
    </div>
  );
}
