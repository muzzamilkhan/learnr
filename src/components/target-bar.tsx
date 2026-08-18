/**
 * The daily target, drawn as one bar.
 *
 * It carries no numbers on purpose. A count in the corner of the play screen is
 * exactly what the header was stripped of - a thing a child watches instead of
 * the question - and a picture of how far along the day is says the same thing
 * without ever being read. The home screen puts the words beside it, where there
 * is room and nothing to be distracted from.
 *
 * Red to green from left to right, so the bar says how the day is going by
 * colour as well as by length: the first question of the day is at the warm end
 * and the last one is at the green end, and getting there is the whole point.
 */

/**
 * A sliver of fill for a day barely started. A bar drawn at 2% is one pixel and
 * reads as nothing done - which is a lie to a child who has just answered.
 */
const MIN_VISIBLE = 0.04;

export function TargetBar({ fraction, className = '' }: { fraction: number; className?: string }) {
  const filled = Math.min(1, Math.max(0, fraction));
  const width = filled === 0 ? 0 : Math.max(MIN_VISIBLE, filled);

  return (
    <div
      role="progressbar"
      aria-label="Today's goal"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(filled * 100)}
      className={`h-2.5 overflow-hidden rounded-full bg-(--color-line) sm:h-3 ${className}`}
    >
      <div
        // A long transition, so the fill glides rather than jumps. It is the same
        // duration whether the bar moved by one question or by a minute's creep,
        // which is what makes the two look like one continuous thing.
        className="h-full rounded-full transition-[width] duration-1000 ease-out"
        style={{
          width: `${width * 100}%`,
          backgroundImage:
            'linear-gradient(90deg, var(--color-wrong), var(--color-star), var(--color-right))',
          // The gradient is sized to the whole track, not to the fill, so a
          // half-full bar is the left half of the run and not a squashed copy of
          // all of it - the colour has to mean the same thing at every length.
          backgroundSize: `${width === 0 ? 100 : 100 / width}% 100%`,
        }}
      >
        <span
          aria-hidden
          className="block h-full w-full animate-[target-sparkle_2.8s_linear_infinite]"
          style={{
            backgroundImage:
              'linear-gradient(100deg, transparent 35%, rgb(255 255 255 / 0.55) 50%, transparent 65%)',
            backgroundSize: '200% 100%',
            backgroundRepeat: 'no-repeat',
          }}
        />
      </div>
    </div>
  );
}
