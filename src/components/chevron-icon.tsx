/**
 * A chevron pointing down: something is folded, and tapping unfolds it.
 *
 * Shared by the two controls that fold - `Select`'s trigger and the speed run
 * picker's operation cards - because the moment it was drawn twice the two
 * would be free to disagree about what "there is more under here" looks like.
 * Both rotate it 180 degrees when open rather than swapping it for an up
 * chevron, so the turn itself is the animation.
 */
export function ChevronIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden className={className}>
      <path
        d="M6 9l6 6 6-6"
        stroke="currentColor"
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
