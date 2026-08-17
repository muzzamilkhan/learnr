/**
 * A door with an arrow leaving it: the way out of a sitting.
 *
 * Drawn rather than written, for the same reason as the tick on the Check key —
 * a child who cannot yet read "Done" can still see where the exit is, and the
 * glyph frees the corner of the header the counts used to fill.
 */
export function ExitIcon() {
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
      <path d="M14 20H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h8" />
      <path d="m16 8 4 4-4 4M20 12H10" />
    </svg>
  );
}
