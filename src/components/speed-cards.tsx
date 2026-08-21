import Link from 'next/link';
import { OPERATIONS, operationGlyph, operationLabel, type Operation } from '@/lib/speedrun/modes';

/**
 * The five operations, as cards.
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
 * `basePath` is what lets one component serve both trees rather than forking a
 * parent copy: the child runs at `/speed/...`, a parent's own runs nest under
 * `/progress/speed/...` (see CLAUDE.md's "Speed run" section on why the
 * parent's routes nest rather than sitting beside the child's as a second
 * top-level path).
 *
 * **There are no links to the scores under them any more.** There used to be
 * two, and every screen that draws these cards now draws the scores directly
 * above them (`SpeedScores`) - so the links were a way out of a screen to
 * something already on it. The cards are what this component is; where they are
 * shown is what says how they got there.
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
    wash: 'bg-(--color-grape-soft)',
    text: 'text-(--color-grape)',
    solid: 'bg-(--color-grape)',
  },
  subtract: {
    tile: 'bg-(--color-leaf-soft) text-(--color-leaf)',
    border: 'hover:border-(--color-leaf)',
    line: 'border-(--color-leaf)',
    wash: 'bg-(--color-leaf-soft)',
    text: 'text-(--color-leaf)',
    solid: 'bg-(--color-leaf)',
  },
  multiply: {
    tile: 'bg-(--color-berry-soft) text-(--color-berry)',
    border: 'hover:border-(--color-berry)',
    line: 'border-(--color-berry)',
    wash: 'bg-(--color-berry-soft)',
    text: 'text-(--color-berry)',
    solid: 'bg-(--color-berry)',
  },
  divide: {
    tile: 'bg-(--color-sun-soft) text-(--color-sun)',
    border: 'hover:border-(--color-sun)',
    line: 'border-(--color-sun)',
    wash: 'bg-(--color-sun-soft)',
    text: 'text-(--color-sun)',
    solid: 'bg-(--color-sun)',
  },
  mixed: {
    tile: 'bg-(--color-brand-soft) text-(--color-brand)',
    border: 'hover:border-(--color-brand)',
    line: 'border-(--color-brand)',
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
  },
  parent: {
    grid: 'grid grid-cols-2 gap-3 sm:grid-cols-3',
    card: 'gap-3 rounded-xl border p-3',
    tile: 'size-9 rounded-lg text-base',
    label: 'text-base',
  },
} as const;

export function SpeedCards({
  basePath = '/speed',
  scale = 'child',
}: {
  /** `/speed` for the child, `/progress/speed` for a parent's own runs. */
  basePath?: string;
  scale?: keyof typeof SCALES;
}) {
  const style = SCALES[scale];

  return (
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
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
