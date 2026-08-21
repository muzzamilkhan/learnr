import Link from 'next/link';
import { modeKey, type Mode } from '@/lib/speedrun/modes';
import { BoltIcon } from './bolt-icon';
import { OPERATION_ACCENT } from './speed-cards';

/**
 * The button along the bottom of a card: this mode, right now.
 *
 * A card names a mode and shows what has been scored at it, and until now the
 * only thing to do about that was to go back out, pick the operation, find the
 * same mode in the chooser and press Start - four taps to answer the question
 * the card just asked. The button is the answer to it, so it sits on the card
 * that asked.
 *
 * **It goes straight into the run, chooser and all skipped.** The mode is
 * already chosen - that is what a card *is* - so a chooser in between would be
 * a screen asking a question that has been answered, with the mode it names
 * already highlighted on it.
 *
 * **The mode rides in the query, not the path.** `/speed/multiply` is a place
 * and `/speed/multiply.7` would be fourteen of them, which is the reason
 * `SpeedRun` takes an operation and owns the choice itself. A query leaves that
 * intact: the route is the same route, and `?mode=` is an instruction about
 * where to start, thrown away the moment the run does.
 *
 * It wears the operation's accent like everything else on the card, so the
 * button that starts a Multiply run is the same pink as the card it sits on and
 * the result that follows it.
 *
 * One component for both walls of cards rather than a copy in each, because
 * the cabinet's card and the leaderboard's card are deliberately the same
 * object - a button that drifted between them is the drift that argument is
 * there to prevent.
 */

const SCALES = {
  child: {
    pad: 'pt-2',
    link: 'h-9 gap-1.5 rounded-xl text-sm',
    bolt: 'size-4',
  },
  parent: {
    pad: 'pt-1.5',
    link: 'h-7 gap-1 rounded-lg text-xs',
    bolt: 'size-3.5',
  },
} as const;

export function SpeedTryLink({
  mode,
  basePath,
  scale,
}: {
  mode: Mode;
  /** `/speed` for the child, `/progress/speed` for a parent's own runs. */
  basePath: string;
  scale: keyof typeof SCALES;
}) {
  const style = SCALES[scale];
  const accent = OPERATION_ACCENT[mode.op];

  return (
    // `mt-auto` so the button sits on the bottom edge of every card whatever the
    // picture above it came to - a row of cards with the button at a different
    // height on each is a row that reads as five different cards. `relative` so
    // it sits above the foil: the sheen is a positioned element, and an
    // unpositioned sibling after it paints underneath.
    <div className={`relative mt-auto shrink-0 ${style.pad}`}>
      <Link
        href={`${basePath}/${mode.op}?mode=${modeKey(mode)}`}
        className={`no-select flex w-full items-center justify-center font-bold text-white transition active:scale-95 ${style.link} ${accent.solid}`}
      >
        <BoltIcon className={style.bolt} />
        Try
      </Link>
    </div>
  );
}
