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
 */
export const OPERATION_ACCENT: Record<
  Operation,
  { tile: string; border: string; arrow: string }
> = {
  add: {
    tile: 'bg-(--color-grape-soft) text-(--color-grape)',
    border: 'hover:border-(--color-grape)',
    arrow: 'text-(--color-grape)',
  },
  subtract: {
    tile: 'bg-(--color-leaf-soft) text-(--color-leaf)',
    border: 'hover:border-(--color-leaf)',
    arrow: 'text-(--color-leaf)',
  },
  multiply: {
    tile: 'bg-(--color-berry-soft) text-(--color-berry)',
    border: 'hover:border-(--color-berry)',
    arrow: 'text-(--color-berry)',
  },
  divide: {
    tile: 'bg-(--color-sun-soft) text-(--color-sun)',
    border: 'hover:border-(--color-sun)',
    arrow: 'text-(--color-sun)',
  },
  mixed: {
    tile: 'bg-(--color-brand-soft) text-(--color-brand)',
    border: 'hover:border-(--color-brand)',
    arrow: 'text-(--color-brand)',
  },
};

export function SpeedCards() {
  return (
    <>
      <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 sm:gap-5">
        {OPERATIONS.map((op) => {
          const accent = OPERATION_ACCENT[op];
          return (
            <li key={op}>
              <Link
                href={`/speed/${op}`}
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
        href="/speed/records"
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
