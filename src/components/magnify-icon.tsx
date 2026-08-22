/**
 * A magnifier, on the corner of a figure that can be opened larger.
 *
 * A picture rather than a word, for the reason the door, the tick and the
 * lightbulb are: this screen is built to need no reading, and a child who
 * cannot read has no other way to discover that the drawing is tappable.
 */
export function MagnifyIcon() {
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
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="M15.5 15.5 21 21" />
      <path d="M10.5 7.5v6M7.5 10.5h6" />
    </svg>
  );
}
