/**
 * An arrow coming back round to where it started: go again.
 *
 * Drawn rather than written, for the reason the door and the tick are - the
 * result screen is the one a child reaches most often and "Try again" is the
 * thing they press hardest to find. A loop is what a repeat looks like on every
 * remote and every music player they have ever seen, and it needs no reading.
 *
 * Clockwise, with the head at the top-right, because the gesture it stands for
 * is going round again rather than going back: an anticlockwise arrow is undo,
 * and undoing is not what this button does.
 */
export function RetryIcon({ className = 'h-8 w-8' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.25}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      {/* Open at the top-right, where the arrowhead closes the loop. */}
      <path d="M20 12a8 8 0 1 1-2.34-5.66" />
      <path d="M20 4v4.5h-4.5" />
    </svg>
  );
}
