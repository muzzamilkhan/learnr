/**
 * A door with an arrow leaving it to the left: the way out of a sitting.
 *
 * Drawn rather than written, for the same reason as the tick on the Check key —
 * a child who cannot yet read "Done" can still see where the exit is, and the
 * glyph frees the corner of the header the counts used to fill.
 *
 * It points left because it sits in the left corner and goes back the way the
 * child came. An arrow leaving rightwards off the left edge of the screen is the
 * one direction the gesture does not mean.
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
      <path d="M10 4h8a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-8" />
      <path d="m8 8-4 4 4 4M14 12H4" />
    </svg>
  );
}
