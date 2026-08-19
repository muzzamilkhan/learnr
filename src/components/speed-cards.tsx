import Link from 'next/link';
import { OPERATIONS, operationGlyph, operationLabel, type Operation } from '@/lib/speedrun/modes';
import { StarIcon } from './star-icon';
import { TrophyIcon } from './trophy-icon';

/**
 * The five operations, as cards, and a link to the cabinet.
 *
 * Follows `SubjectCards`' treatment - a coloured glyph tile, the name in large
 * type - but stripped of the topic chips, since a speed run has no topics to
 * name and no year to caption itself with. That absence is the point: this
 * section sits beside "Practice", not inside its level picker.
 *
 * One accent per operation rather than a cycled palette, so "addition" is the
 * same colour here as it is on the cabinet below - `OPERATION_ACCENT` is shared
 * by both rather than each guessing an index into the same four colours.
 *
 * `basePath`, `recordsHref` and `leaderboardHref` are what let one component
 * serve both trees rather than forking a parent copy: the child runs at
 * `/speed/...`, a
 * parent's own runs nest under `/progress/speed/...` (see CLAUDE.md's
 * "Speed run" section on why the parent's routes nest rather than sitting
 * beside the child's as a second top-level path).
 */
/**
 * One accent per operation, and every class written out in full.
 *
 * `wash`, `text` and `solid` are here for the result screen, which dresses
 * itself in the colour of the operation just run - so finishing a Multiply run
 * looks like the Multiply card that started it. They live beside `tile` rather
 * than being built from a token name because Tailwind reads class names as
 * literals: `bg-(--color-${op}-soft)` compiles to nothing at all.
 */
export type Accent = {
  tile: string;
  border: string;
  arrow: string;
  /** The page behind a result: the accent at its palest. */
  wash: string;
  /** The score itself, and anything else meant to carry the colour. */
  text: string;
  /** A filled button in the accent, always with white on it. */
  solid: string;
  /** A border drawn in the accent, unconditionally - `border` is a hover. */
  line: string;
};

export const OPERATION_ACCENT: Record<Operation, Accent> = {
  add: {
    tile: 'bg-(--color-grape-soft) text-(--color-grape)',
    border: 'hover:border-(--color-grape)',
    line: 'border-(--color-grape)',
    arrow: 'text-(--color-grape)',
    wash: 'bg-(--color-grape-soft)',
    text: 'text-(--color-grape)',
    solid: 'bg-(--color-grape)',
  },
  subtract: {
    tile: 'bg-(--color-leaf-soft) text-(--color-leaf)',
    border: 'hover:border-(--color-leaf)',
    line: 'border-(--color-leaf)',
    arrow: 'text-(--color-leaf)',
    wash: 'bg-(--color-leaf-soft)',
    text: 'text-(--color-leaf)',
    solid: 'bg-(--color-leaf)',
  },
  multiply: {
    tile: 'bg-(--color-berry-soft) text-(--color-berry)',
    border: 'hover:border-(--color-berry)',
    line: 'border-(--color-berry)',
    arrow: 'text-(--color-berry)',
    wash: 'bg-(--color-berry-soft)',
    text: 'text-(--color-berry)',
    solid: 'bg-(--color-berry)',
  },
  divide: {
    tile: 'bg-(--color-sun-soft) text-(--color-sun)',
    border: 'hover:border-(--color-sun)',
    line: 'border-(--color-sun)',
    arrow: 'text-(--color-sun)',
    wash: 'bg-(--color-sun-soft)',
    text: 'text-(--color-sun)',
    solid: 'bg-(--color-sun)',
  },
  mixed: {
    tile: 'bg-(--color-brand-soft) text-(--color-brand)',
    border: 'hover:border-(--color-brand)',
    line: 'border-(--color-brand)',
    arrow: 'text-(--color-brand)',
    wash: 'bg-(--color-brand-soft)',
    text: 'text-(--color-brand)',
    solid: 'bg-(--color-brand)',
  },
};

/**
 * `scale` follows `SpeedRecordsCabinet`'s precedent, and for the same reason:
 * these cards are sized for a six-year-old holding an iPad at arm's length, and
 * a parent choosing their own run is reading a laptop with a report on it. At
 * `'parent'` they run at the density everything else under `ParentShell` does -
 * `text-base` labels, single-width borders, `rounded-xl` - so the speed screens
 * stop being the one part of a parent's app shouting at them.
 */
const SCALES = {
  child: {
    grid: 'grid grid-cols-2 gap-4 sm:grid-cols-3 sm:gap-5',
    card: 'gap-4 rounded-3xl border-2 p-5 shadow-sm hover:shadow-md',
    tile: 'size-14 rounded-2xl text-2xl',
    label: 'text-2xl',
    arrow: 'text-2xl',
    records: 'mt-4 gap-3 rounded-2xl border-2 px-5 py-3.5 text-lg',
    star: 'h-6 w-6',
    recordsArrow: 'text-2xl',
  },
  parent: {
    grid: 'grid grid-cols-2 gap-3 sm:grid-cols-3',
    card: 'gap-3 rounded-xl border p-3',
    tile: 'size-9 rounded-lg text-base',
    label: 'text-base',
    arrow: 'text-base',
    records: 'mt-3 gap-2 rounded-xl border px-3 py-2 text-sm',
    star: 'h-4 w-4',
    recordsArrow: 'text-base',
  },
} as const;

export function SpeedCards({
  basePath = '/speed',
  recordsHref = `${basePath}/records`,
  leaderboardHref = `${basePath}/leaderboard`,
  scale = 'child',
}: {
  /** `/speed` for the child, `/progress/speed` for a parent's own runs. */
  basePath?: string;
  recordsHref?: string;
  leaderboardHref?: string;
  scale?: keyof typeof SCALES;
}) {
  const style = SCALES[scale];

  return (
    <>
      <ul className={style.grid}>
        {OPERATIONS.map((op) => {
          const accent = OPERATION_ACCENT[op];
          return (
            <li key={op}>
              <Link
                href={`${basePath}/${op}`}
                className={`no-select flex items-center border-(--color-line) bg-(--color-card) transition active:scale-[0.98] ${style.card} ${accent.border}`}
              >
                <span
                  aria-hidden
                  className={`flex shrink-0 items-center justify-center font-bold ${style.tile} ${accent.tile}`}
                >
                  {operationGlyph(op)}
                </span>
                <span className={`min-w-0 flex-1 font-semibold ${style.label}`}>
                  {operationLabel(op)}
                </span>
                <span aria-hidden className={`shrink-0 ${style.arrow} ${accent.arrow}`}>
                  &rarr;
                </span>
              </Link>
            </li>
          );
        })}
      </ul>

      <Link
        href={recordsHref}
        className={`no-select flex items-center border-(--color-line) bg-(--color-card) font-semibold text-(--color-ink-soft) transition hover:border-(--color-brand) active:scale-[0.98] ${style.records}`}
      >
        <StarIcon filled className={`shrink-0 text-(--color-star) ${style.star}`} />
        Your records
        <span aria-hidden className={`ml-auto ${style.recordsArrow}`}>
          &rarr;
        </span>
      </Link>

      <Link
        href={leaderboardHref}
        className={`no-select flex items-center border-(--color-line) bg-(--color-card) font-semibold text-(--color-ink-soft) transition hover:border-(--color-brand) active:scale-[0.98] ${style.records}`}
      >
        <TrophyIcon className={`shrink-0 text-(--color-star) ${style.star}`} />
        Family leaderboard
        <span aria-hidden className={`ml-auto ${style.recordsArrow}`}>
          &rarr;
        </span>
      </Link>
    </>
  );
}
