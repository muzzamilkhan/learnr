/**
 * A star. Drawn hollow when it was not earned, so a child can see what the round
 * was worth as well as what they got — three outlines is a target, not a rebuke.
 */
export function StarIcon({
  filled,
  className = '',
  style,
}: {
  filled: boolean;
  className?: string;
  /** Used to stagger a row of them; nothing else belongs here. */
  style?: React.CSSProperties;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
      style={style}
    >
      <path d="M12 2.6l2.9 5.9 6.5.9-4.7 4.6 1.1 6.4-5.8-3-5.8 3 1.1-6.4L2.6 9.4l6.5-.9z" />
    </svg>
  );
}

/** A flame for the day streak — the one thing on screen that is about coming back. */
export function FlameIcon({ className = '' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      className={className}
    >
      <path d="M12.6 2.2c.3 2.6-.6 4.2-2 5.6-1.6 1.6-3.6 3-3.6 6.1a7 7 0 0 0 14 0c0-2.7-1.2-4.6-2.6-6-.2 1-.8 1.8-1.6 2.2.3-2.9-1.2-6-4.2-7.9Zm-.6 10c1.3 1 2 2.1 2 3.4a2 2 0 1 1-4 0c0-1.2.8-2.4 2-3.4Z" />
    </svg>
  );
}
