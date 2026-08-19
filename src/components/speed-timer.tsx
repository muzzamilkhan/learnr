'use client';

import { useEffect, useRef } from 'react';
import { SPEED_RUN_MS, type Pulse } from '@/lib/speedrun/run';

/**
 * The ninety seconds, drawn as the progress bar going the other way: draining,
 * no numbers, and beating harder as it empties.
 *
 * No numbers for the reason the play screen's header counts nothing - a figure
 * is a thing to watch instead of the question. A picture of how much is left
 * says the same thing without ever being read.
 *
 * The width is **one CSS transition set once at run start** rather than state
 * ticking down. A bar driven by React at ten frames a second would re-render the
 * whole screen underneath a child answering as fast as they can, to say what a
 * transition says for free. Only the pulse comes from React, and it changes
 * three times in ninety seconds.
 *
 * The gradient is sized to the whole track rather than to the fill - the
 * technique `TargetBar` uses - so the colour means the same thing at every
 * length: green while there is time, red when there is not. It is its own
 * component rather than a flag on `TargetBar` because one component with two
 * personalities is worse than two that share a technique.
 */

const PULSE_CLASS: Record<Pulse, string> = {
  calm: '',
  slow: 'animate-[speed-pulse_1400ms_ease-in-out_infinite]',
  fast: 'animate-[speed-pulse_800ms_ease-in-out_infinite]',
  urgent: 'animate-[speed-pulse_420ms_ease-in-out_infinite]',
};

export function SpeedTimer({ runningSince, pulse }: { runningSince: number | null; pulse: Pulse }) {
  const fill = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const bar = fill.current;
    const track = bar?.parentElement;
    if (!bar || !track || runningSince === null) return;

    // The gradient is painted across the whole track from the fill's left edge,
    // so a bar with a quarter left shows the leftmost quarter of the run rather
    // than a squashed copy of all of it. `TargetBar` does this with a percentage
    // because its fill is styled at a known width; here the width lives in a CSS
    // transition and React never knows what it is, so the track is measured
    // instead. Re-measured on a turned iPad, since the pixels change and the
    // meaning must not.
    const size = () => {
      bar.style.backgroundSize = `${track.clientWidth}px 100%`;
    };
    size();
    const observer = new ResizeObserver(size);
    observer.observe(track);

    // Start from wherever the clock actually is, so a remount mid-run does not
    // hand back time that has already gone.
    const gone = Math.max(0, Date.now() - runningSince);
    const left = Math.max(0, SPEED_RUN_MS - gone);

    bar.style.transition = 'none';
    bar.style.width = `${(left / SPEED_RUN_MS) * 100}%`;
    // Forced reflow, so the browser has a width to transition *from*. Without it
    // both style writes land in one frame and the bar jumps straight to zero.
    void bar.offsetWidth;
    bar.style.transition = `width ${left}ms linear`;
    bar.style.width = '0%';

    return () => observer.disconnect();
  }, [runningSince]);

  return (
    // No `aria-valuenow`: the value is in the CSS transition and React never
    // holds it, so a number here could only ever be a stale one. An unset value
    // on a progressbar is how ARIA spells "still going", which is the truth.
    <div
      role="progressbar"
      aria-label="Time left"
      aria-valuemin={0}
      aria-valuemax={100}
      className={`h-2.5 w-full overflow-hidden rounded-full bg-(--color-line) sm:h-3 ${PULSE_CLASS[pulse]}`}
    >
      <div
        ref={fill}
        className="h-full w-full rounded-full"
        style={{
          // Red at the left and green at the right, because the fill drains from
          // the right: what is left at the end is the red end of the run.
          backgroundImage:
            'linear-gradient(90deg, var(--color-wrong), var(--color-star), var(--color-right))',
        }}
      />
    </div>
  );
}
