import Link from 'next/link';
import {
  isSingleTable,
  type Mode,
  modeKey,
  modeLabel,
  modesFor,
  OPERATIONS,
  operationGlyph,
  operationLabel,
  type Operation,
} from '@/lib/speedrun/modes';
import { ChevronIcon } from './chevron-icon';

/**
 * The five operations, and every mode underneath the one that is open.
 *
 * **Choosing a run is one screen.** It used to be two: five cards here, each a
 * link to `/speed/<op>`, and a second screen there whose whole job was to ask
 * which variation - with a Start button under it to confirm a question that
 * had already been answered twice. Three taps and a page load to begin ninety
 * seconds. The operation card now opens in place and its modes are the buttons
 * that start the run, so it is two taps and the second one *is* the run.
 *
 * **A `<details>`, not client state**, exactly as the report's "Needs a hand"
 * rows are: the modes are rendered with the page and the disclosure is the
 * whole interaction, so this stays a server component with no hydration and no
 * `'use client'`, and a browser that never runs the JS still opens it.
 *
 * **Opening one closes the others**, and that is `name` on the `<details>`
 * rather than an `onToggle` and a piece of state: the five share a name, which
 * is the platform's own accordion and the whole reason not to reach for a
 * client component to get it. An engine too old to know the attribute leaves
 * them all independently openable, which is the behaviour this had before and
 * not a broken screen. Exclusive because the open card is fourteen chips tall
 * at its worst, and two of those open at once is a section a child scrolls
 * past rather than reads.
 *
 * **The cards are a stack, not a grid.** A card that opens has to open to the
 * full width of the screen or its modes are chips in a column, and a two-column
 * grid with one cell three times the height of its neighbour is a hole in a
 * row. Five wide rows is also the shape the thing actually is now: a list of
 * five things, one of which is showing its contents.
 *
 * Follows `SubjectCards`' treatment in the closed state - a coloured glyph
 * tile, the name in large type - but stripped of the topic chips, since a speed
 * run has no topics to name and no year to caption itself with. That absence is
 * the point: this section sits beside "Practice", not inside its level picker.
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
 *
 * The mode chips carry that same split, and their sizes are the ones the
 * chooser screen used before it was folded in here: a child's are thumb-sized
 * targets, a parent's a denser grid.
 *
 * **Two grids, because multiply has two kinds of chip.** A single table reads
 * "7x" and a bundle reads "11x to 12x", and a grid wide enough for the second
 * wastes most of a row on the first - which is what made fourteen multiply
 * modes seven rows of mostly white space. The singles get a dense run of small
 * square targets and the bundles the ordinary wide row beneath them, so the
 * tallest card in the picker is four rows rather than seven. Every other
 * operation has no singles at all and draws one grid, exactly as before.
 */
const SCALES = {
  child: {
    list: 'space-y-4',
    card: 'rounded-3xl border-2 shadow-sm hover:shadow-md',
    summary: 'gap-4 p-5',
    tile: 'size-14 rounded-2xl text-2xl',
    label: 'text-2xl',
    chevron: 'size-6',
    tables: 'grid grid-cols-4 gap-3 px-5 pt-1 sm:grid-cols-5 sm:gap-4',
    modes: 'grid grid-cols-2 gap-3 px-5 pt-3 pb-5 sm:grid-cols-3 sm:gap-4',
    mode: 'min-h-16 rounded-2xl border-2 px-2 py-2.5 text-lg sm:min-h-18 sm:text-xl',
  },
  parent: {
    list: 'space-y-2',
    card: 'rounded-xl border',
    summary: 'gap-3 p-3',
    tile: 'size-9 rounded-lg text-base',
    label: 'text-base',
    chevron: 'size-4',
    tables: 'grid grid-cols-5 gap-2 px-3 sm:grid-cols-6',
    modes: 'grid grid-cols-2 gap-2 px-3 pt-2 pb-3 sm:grid-cols-4',
    mode: 'min-h-11 rounded-xl border px-2 py-1.5 text-sm',
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
    <ul className={style.list}>
      {OPERATIONS.map((op) => {
        const accent = OPERATION_ACCENT[op];
        const modes = modesFor(op);
        // Only multiply has both; every other operation puts its lot in the
        // second grid and never draws the first.
        const tables = modes.filter(isSingleTable);
        const rest = modes.filter((mode) => !isSingleTable(mode));

        const chip = (mode: Mode) => (
          <Link
            key={modeKey(mode)}
            href={`${basePath}/${modeKey(mode)}`}
            className={`flex items-center justify-center border-(--color-line) bg-(--color-card) text-center leading-tight font-semibold transition active:scale-95 ${style.mode} ${accent.border}`}
          >
            {modeLabel(mode)}
          </Link>
        );

        return (
          <li key={op}>
            <details
              // The five share a name, so opening one closes the rest - the
              // platform's own accordion, and the reason this needs no state.
              name="speed-operation"
              className={`group no-select overflow-hidden border-(--color-line) bg-(--color-card) transition ${style.card} ${accent.border}`}
            >
              {/* `list-none` and the WebKit pseudo-element together are what
                  remove the browser's own triangle - Safari draws it from the
                  second and every other engine from the first, and the chevron
                  below is the one that turns with the card. */}
              <summary
                className={`flex cursor-pointer list-none items-center transition active:scale-[0.98] [&::-webkit-details-marker]:hidden ${style.summary}`}
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
                <ChevronIcon
                  className={`shrink-0 text-(--color-ink-soft) transition group-open:rotate-180 ${style.chevron}`}
                />
              </summary>

              {/* Every chip is a plain link into the run, and there is no Start
                  button under them: the mode is the last question there is, so
                  answering it is the thing that begins the ninety seconds. */}
              {tables.length > 0 && (
                <div className={style.tables}>{tables.map(chip)}</div>
              )}
              <div className={style.modes}>{rest.map(chip)}</div>
            </details>
          </li>
        );
      })}
    </ul>
  );
}
