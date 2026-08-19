/**
 * A trophy: the mark of the family leaderboard, wherever it is offered.
 *
 * Drawn rather than written, like the bolt beside it and the star above it - a
 * child who cannot yet read "Family leaderboard" can still tell which of the
 * two links under the cards is the one with everybody on it.
 */
export function TrophyIcon({ className = 'h-8 w-8' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className}>
      <path d="M6 3h12a1 1 0 0 1 1 1v1h2a1 1 0 0 1 1 1v1a4 4 0 0 1-3.7 4 6 6 0 0 1-3.3 2.9V16h2a1 1 0 0 1 1 1v1H6v-1a1 1 0 0 1 1-1h2v-2.1A6 6 0 0 1 5.7 11 4 4 0 0 1 2 7V6a1 1 0 0 1 1-1h2V4a1 1 0 0 1 1-1Zm13 4v2.8A2 2 0 0 0 20 8V7h-1ZM5 7H4v1a2 2 0 0 0 1 1.8V7ZM5 20h14a1 1 0 1 1 0 2H5a1 1 0 1 1 0-2Z" />
    </svg>
  );
}
