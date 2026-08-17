/**
 * A bin: remove this child.
 *
 * A bin rather than a cross, because a cross on a card reads as "close this" —
 * and the one thing this button must not be mistaken for is dismissing the row.
 * It only opens the confirmation, which is where the card says what is actually
 * lost. See `EditIcon` for why these two are glyphs at all.
 */
export function RemoveIcon() {
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
      <path d="M4 7h16" />
      <path d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
      <path d="M6 7h12l-.8 12.1a1 1 0 0 1-1 .9H7.8a1 1 0 0 1-1-.9Z" />
      <path d="M10 11v6M14 11v6" />
    </svg>
  );
}
