/**
 * Two sheets, one behind the other: copy this to the clipboard. Turns into a
 * tick once it has, which is the only feedback a copy gets — nothing visibly
 * happens otherwise, and a button that looks the same before and after leaves a
 * parent tapping it twice.
 *
 * One component rather than two, so the swap is in one place and the glyph can
 * never be the wrong one for the state.
 */
export function CopyIcon({ copied }: { copied: boolean }) {
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
      {copied ? (
        <path d="m5 12.5 4.5 4.5L19 7" />
      ) : (
        <>
          <rect x="9" y="9" width="11" height="11" rx="2" />
          <path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1" />
        </>
      )}
    </svg>
  );
}
