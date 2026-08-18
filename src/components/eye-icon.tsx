/**
 * An eye, and the same eye with a stroke through it: show the code that is
 * already stored, or put it away again. One component so the two can never
 * drift apart, and so the button's two states are visibly the same button.
 *
 * Revealing is not issuing - see `KeyIcon`, which is the state that hands out a
 * new code.
 */
export function EyeIcon({ off }: { off: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="h-4 w-4"
    >
      <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6Z" />
      <circle cx="12" cy="12" r="3" />
      {off ? <path d="m4 20 16-16" /> : null}
    </svg>
  );
}
