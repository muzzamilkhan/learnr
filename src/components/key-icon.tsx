/**
 * A key: hand this child a way in. It marks the one state of the code button
 * that changes something - issuing a code the card doesn't have yet - where the
 * other two only reveal or hide what is already stored.
 *
 * A key rather than an eye for that reason: an eye on all three would say the
 * button does the same thing every time, and it doesn't.
 */
export function KeyIcon() {
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
      <circle cx="8" cy="15" r="4" />
      <path d="m11 12 8-8 2 2-2 2 2 2-2 2-2-2-2 2" />
    </svg>
  );
}
