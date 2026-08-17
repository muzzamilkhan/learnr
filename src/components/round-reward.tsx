'use client';

import { useEffect } from 'react';
import type { Round } from '@/lib/rewards/stars';
import { ROUND_SIZE } from '@/lib/rewards/stars';
import { StarIcon } from './star-icon';

/**
 * The break after ten questions. It covers the screen because that is the point
 * — the child stops, sees what the round was worth, and starts the next one
 * fresh — but it never traps them: a tap anywhere goes on, and it leaves by
 * itself if they just watch it.
 */

/** Long enough to watch the last star land and read the line under it. */
const SHOWN_MS = 3400;

/** Each star arrives after the one before, so three of them read as three events. */
const STAR_DELAY_MS = 320;

/** Encouraging at every count. A round that went badly still got finished. */
const PRAISE: Record<number, string> = {
  3: 'Perfect round!',
  2: 'Nice work!',
  1: 'Round finished!',
};

export function RoundReward({ round, onDone }: { round: Round; onDone: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onDone, SHOWN_MS);
    return () => clearTimeout(timer);
  }, [round, onDone]);

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label="Continue"
      onClick={onDone}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') onDone();
      }}
      className="no-select fixed inset-0 z-30 flex flex-col items-center justify-center gap-6 bg-(--color-paper)/95 px-8 backdrop-blur-sm sm:gap-8"
    >
      <div
        className="flex items-end gap-3 text-(--color-star) sm:gap-5"
        aria-label={`${round.stars} out of 3 stars`}
      >
        {[1, 2, 3].map((position) => (
          <StarIcon
            key={position}
            filled={position <= round.stars}
            // The middle star sits higher, so three of them make a shape rather
            // than a row of icons.
            className={`h-20 w-20 animate-[star-land_450ms_ease-out_both] sm:h-28 sm:w-28 ${
              position === 2 ? '-mb-2 sm:-mb-4' : ''
            } ${position <= round.stars ? '' : 'opacity-30'}`}
            style={{ animationDelay: `${(position - 1) * STAR_DELAY_MS}ms` }}
          />
        ))}
      </div>

      <div className="animate-[reward-in_400ms_ease-out_both] space-y-2 text-center [animation-delay:900ms]">
        <p className="text-4xl font-bold sm:text-5xl">{PRAISE[round.stars]}</p>
        <p className="text-xl text-(--color-ink-soft) sm:text-2xl">
          {round.correct} of {ROUND_SIZE} right
        </p>
      </div>

      <p className="text-lg text-(--color-ink-soft)/70 sm:text-xl">Tap to keep going</p>
    </div>
  );
}
