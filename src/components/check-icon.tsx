/** Drawn rather than typed, for the same reason as the backspace glyph: a tick
 * needs no reading, so the same key works before a child can read "Check". */
export function CheckIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={3}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="h-10 w-10"
    >
      <path d="m4 12.5 5.5 5.5L20 6.5" />
    </svg>
  );
}
