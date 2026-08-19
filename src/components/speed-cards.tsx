import Link from 'next/link';
import { OPERATIONS, operationGlyph, operationLabel, type Operation } from '@/lib/speedrun/modes';
import { StarIcon } from './star-icon';

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
 * `basePath` and `recordsHref` are what let one component serve both trees
 * rather than forking a parent copy: the child runs at `/speed/...`, a
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
};

export const OPERATION_ACCENT: Record<Operation, Accent> = {
  add: {
    tile: 'bg-(--color-grape-soft) text-(--color-grape)',
    border: 'hover:border-(--color-grape)',
    arrow: 'text-(--color-grape)',
    wash: 'bg-(--color-grape-soft)',
    text: 'text-(--color-grape)',
    solid: 'bg-(--color-grape)',
  },
  subtract: {
    tile: 'bg-(--color-leaf-soft) text-(--color-leaf)',
    border: 'hover:border-(--color-leaf)',
    arrow: 'text-(--color-leaf)',
    wash: 'bg-(--color-leaf-soft)',
    text: 'text-(--color-leaf)',
    solid: 'bg-(--color-leaf)',
  },
  multiply: {
    tile: 'bg-(--color-berry-soft) text-(--color-berry)',
    border: 'hover:border-(--color-berry)',
    arrow: 'text-(--color-berry)',
    wash: 'bg-(--color-berry-soft)',
    text: 'text-(--color-berry)',
    solid: 'bg-(--color-berry)',
  },
  divide: {
    tile: 'bg-(--color-sun-soft) text-(--color-sun)',
    border: 'hover:border-(--color-sun)',
    arrow: 'text-(--color-sun)',
    wash: 'bg-(--color-sun-soft)',
    text: 'text-(--color-sun)',
    solid: 'bg-(--color-sun)',
  },
  mixed: {
    tile: 'bg-(--color-brand-soft) text-(--color-brand)',
    border: 'hover:border-(--color-brand)',
    arrow: 'text-(--color-brand)',
    wash: 'bg-(--color-brand-soft)',
    text: 'text-(--color-brand)',
    solid: 'bg-(--color-brand)',
  },
};

export function SpeedCards({
  basePath = '/speed',
  recordsHref = `${basePath}/records`,
}: {
  /** `/speed` for the child, `/progress/speed` for a parent's own runs. */
  basePath?: string;
  recordsHref?: string;
}) {
  return (
    <>
      <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 sm:gap-5">
        {OPERATIONS.map((op) => {
          const accent = OPERATION_ACCENT[op];
          return (
            <li key={op}>
              <Link
                href={`${basePath}/${op}`}
                className={`no-select flex items-center gap-4 rounded-3xl border-2 border-(--color-line) bg-(--color-card) p-5 shadow-sm transition hover:shadow-md active:scale-[0.98] ${accent.border}`}
              >
                <span
                  aria-hidden
                  className={`flex size-14 shrink-0 items-center justify-center rounded-2xl text-2xl font-bold ${accent.tile}`}
                >
                  {operationGlyph(op)}
                </span>
                <span className="min-w-0 flex-1 text-2xl font-semibold">
                  {operationLabel(op)}
                </span>
                <span aria-hidden className={`shrink-0 text-2xl ${accent.arrow}`}>
                  &rarr;
                </span>
              </Link>
            </li>
          );
        })}
      </ul>

      <Link
        href={recordsHref}
        className="no-select mt-4 flex items-center gap-3 rounded-2xl border-2 border-(--color-line) bg-(--color-card) px-5 py-3.5 text-lg font-semibold text-(--color-ink-soft) transition hover:border-(--color-brand) active:scale-[0.98]"
      >
        <StarIcon filled className="h-6 w-6 shrink-0 text-(--color-star)" />
        Your records
        <span aria-hidden className="ml-auto text-2xl">
          &rarr;
        </span>
      </Link>
    </>
  );
}
