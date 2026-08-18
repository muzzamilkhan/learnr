'use client';

import { useEffect } from 'react';
import { formatCount } from '@/lib/format';
import { FlameIcon } from './star-icon';

/**
 * Shown once, on the first answer of a day: the streak the child has just
 * extended. It is deliberately a flash and not a fixture - a number that sits on
 * the play screen all session is one more thing to worry about, and this app
 * does not put anything on screen for a child to lose.
 *
 * It floats over the layout rather than in it, because the play screen is a
 * fixed viewport height that may not scroll and has no room to give.
 */

/** Matches the `streak-flash` keyframes, which fade it out at the end themselves. */
const SHOWN_MS = 2600;

export function StreakFlash({ days, onDone }: { days: number; onDone: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onDone, SHOWN_MS);
    return () => clearTimeout(timer);
  }, [days, onDone]);

  return (
    <div
      // Announced, but never in the way of a tap.
      role="status"
      className="pointer-events-none fixed inset-x-0 top-3 z-40 flex justify-center px-4 sm:top-5"
    >
      <div className="flex animate-[streak-flash_2600ms_ease-out_both] items-center gap-2 rounded-full border-2 border-(--color-flame)/25 bg-(--color-flame-soft) px-5 py-2.5 shadow-lg shadow-(--color-flame)/10 sm:gap-3 sm:px-7 sm:py-3">
        <FlameIcon className="h-7 w-7 text-(--color-flame) sm:h-8 sm:w-8" />
        <p className="text-xl font-bold text-(--color-flame) sm:text-2xl">
          <span className="inline-block animate-[streak-count_600ms_ease-out_400ms] tabular-nums">
            {formatCount(days)}
          </span>{' '}
          day{days === 1 ? '' : 's'} in a row
        </p>
      </div>
    </div>
  );
}
