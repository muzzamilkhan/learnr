/**
 * Keeping Tab inside an overlay, split the way the rest of this app splits
 * things: the arithmetic here and tested, the DOM work at the one call site.
 *
 * `aria-modal` is a promise to a screen reader that the rest of the page is
 * inert, and a Tab that walks out of the dialog and onto the play screen behind
 * it breaks that promise silently - the reader is told nothing and the focus
 * ring is under an opaque overlay, so there is nothing to see either.
 */

/**
 * What a dialog's tab stops are. Everything focusable by default, plus anything
 * given a tab stop explicitly - and never `tabindex="-1"`, which is how an
 * element says it takes focus programmatically but is not a stop.
 *
 * The dialog itself is `-1` for exactly that reason, so it is deliberately not
 * in its own list.
 */
export const FOCUS_STOPS =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Which stop Tab moves to, given how many there are and where focus is now.
 *
 * `current` is `-1` when focus is on something that is not a stop - which is
 * the ordinary state on open, since the dialog holds focus itself so that it is
 * announced. From there Tab enters at the near end and Shift+Tab at the far
 * one, which is what the platform does at the edges of a document.
 *
 * Returns `-1` when there is nothing to focus, which is the common case here: a
 * figure whose prompt is not repeatable has no stop inside the overlay at all,
 * and the answer is to leave focus where it is rather than to let it out.
 */
export function nextFocusIndex(count: number, current: number, backwards: boolean): number {
  if (count <= 0) return -1;
  if (current < 0) return backwards ? count - 1 : 0;
  return (current + (backwards ? -1 : 1) + count) % count;
}
