import { describe, expect, it } from 'vitest';

import { nextFocusIndex } from './focus-trap';

/**
 * The trap itself is DOM work - collect the stops, read `document.activeElement`,
 * call `focus()` - and vitest here is node-only, so none of that is testable.
 * What *is* arithmetic is which stop Tab lands on, including the two cases that
 * are easy to get wrong by hand: wrapping backwards off the first stop, and
 * arriving from focus that is not a stop at all (the dialog itself, which is
 * `tabIndex={-1}` and so never in the list).
 */
describe('nextFocusIndex', () => {
  it('moves forwards and backwards through the stops', () => {
    expect(nextFocusIndex(3, 0, false)).toBe(1);
    expect(nextFocusIndex(3, 1, false)).toBe(2);
    expect(nextFocusIndex(3, 2, true)).toBe(1);
    expect(nextFocusIndex(3, 1, true)).toBe(0);
  });

  it('wraps at both ends, which is the whole of what makes it a trap', () => {
    expect(nextFocusIndex(3, 2, false)).toBe(0);
    expect(nextFocusIndex(3, 0, true)).toBe(2);
  });

  it('enters at the first stop forwards and the last backwards', () => {
    // -1 is focus sitting on the dialog itself: it holds focus on open so the
    // overlay is announced, and it is not a tab stop, so Tab has to decide
    // which end to enter from rather than which neighbour to step to.
    expect(nextFocusIndex(3, -1, false)).toBe(0);
    expect(nextFocusIndex(3, -1, true)).toBe(2);
  });

  it('has nowhere to go when there are no stops', () => {
    // A figure with no repeatable prompt is this: the dialog is the only thing
    // focusable in it, and Tab must leave focus where it is rather than
    // escaping to the play screen behind.
    expect(nextFocusIndex(0, -1, false)).toBe(-1);
    expect(nextFocusIndex(0, -1, true)).toBe(-1);
  });

  it('keeps one stop to itself', () => {
    expect(nextFocusIndex(1, 0, false)).toBe(0);
    expect(nextFocusIndex(1, 0, true)).toBe(0);
  });
});
