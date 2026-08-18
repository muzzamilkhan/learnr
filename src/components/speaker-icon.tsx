/**
 * A speaker, with sound waves coming off it or a stroke through it: the question
 * is being read aloud, or it isn't.
 *
 * One component for both states, like `EyeIcon`, so the two can never drift
 * apart and the toggle is visibly one button. Drawn rather than written for the
 * reason that matters most here - the child reaching for it is the one who
 * cannot read the word "Read aloud".
 */
export function SpeakerIcon({ off }: { off: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="h-8 w-8"
    >
      <path d="M11 5 6.5 9H3v6h3.5L11 19V5Z" />
      {off ? (
        <path d="m15 9 5 6M20 9l-5 6" />
      ) : (
        <path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13" />
      )}
    </svg>
  );
}
