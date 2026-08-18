'use client';

import { useEffect } from 'react';
import { TARGET_STARS, type DailyTarget } from '@/lib/rewards/target';
import { StarIcon } from './star-icon';
import { playSound } from './sounds';

/**
 * The day's goal, reached. Ten stars is the largest single award in the app, so
 * it gets a screen of its own rather than a line on somebody else's.
 *
 * It shares the round celebration's shape and its fanfare deliberately - a child
 * has learned what that screen and that sound mean, and this is the same kind of
 * event, only bigger. What differs is what it says: the round says how the last
 * ten questions went, and this says the day is done.
 *
 * Like the round's stars it never traps anybody: a tap goes on, and it leaves by
 * itself if they just watch it.
 */

/** A beat longer than a round's stars - there is a sentence more to read. */
const SHOWN_MS = 4000;

export function TargetReward({ target, onDone }: { target: DailyTarget; onDone: () => void }) {
  useEffect(() => {
    playSound('tada');
  }, []);

  useEffect(() => {
    const timer = setTimeout(onDone, SHOWN_MS);
    return () => clearTimeout(timer);
  }, [onDone]);

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
        className="flex items-center gap-3 text-(--color-star)"
        aria-label={`${TARGET_STARS} stars`}
      >
        <StarIcon
          filled
          className="h-24 w-24 animate-[star-land_450ms_ease-out_both] sm:h-32 sm:w-32"
        />
        <span className="animate-[reward-in_400ms_ease-out_both] text-6xl font-bold tabular-nums [animation-delay:250ms] sm:text-7xl">
          +{TARGET_STARS}
        </span>
      </div>

      <div className="animate-[reward-in_400ms_ease-out_both] space-y-2 text-center [animation-delay:700ms]">
        <p className="text-4xl font-bold sm:text-5xl">Goal reached!</p>
        <p className="text-xl text-(--color-ink-soft) sm:text-2xl">
          {target.kind === 'minutes'
            ? `${target.value} minutes of practice today`
            : `${target.value} questions today`}
        </p>
      </div>

      {/* Never "you can stop now". The goal is a floor, and carrying on past it
          is the thing this app would rather they did. */}
      <p className="text-lg text-(--color-ink-soft)/70 sm:text-xl">Tap to keep going</p>
    </div>
  );
}
