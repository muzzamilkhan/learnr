/**
 * A crown for the top of the podium.
 *
 * It sits *above* the winner's face rather than across it: the board shows a
 * face instead of a name (see `FamilyLeaderboard`), so anything drawn over the
 * picture would cover the one thing a pre-literate child reads the screen for.
 */
export function CrownIcon({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className}>
      <path
        d="M3.4 8.6 7.6 12 11.2 5.2a.9.9 0 0 1 1.6 0L16.4 12l4.2-3.4a.9.9 0 0 1 1.4.9l-1.9 8.1a1 1 0 0 1-1 .8H4.9a1 1 0 0 1-1-.8L2 9.5a.9.9 0 0 1 1.4-.9Z"
        strokeLinejoin="round"
      />
      <rect x="4.6" y="19.4" width="14.8" height="2.2" rx="1.1" />
    </svg>
  );
}
