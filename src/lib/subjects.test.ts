import { describe, expect, it } from 'vitest';
import { parseSubjects, subjectsAllowed } from './subjects';

// What the catalog offers, injected the way `resolveInitialLevel` takes its
// levels: which subjects exist is derived from the shipped templates, and
// `src/lib` is the half that never reads them.
const AVAILABLE = ['maths', 'english'];

describe('parseSubjects', () => {
  it('keeps the subjects that have content', () => {
    expect(parseSubjects(['maths', 'english'], AVAILABLE)).toEqual(['maths', 'english']);
  });

  it('drops a subject nothing is written for', () => {
    expect(parseSubjects(['maths', 'astronomy'], AVAILABLE)).toEqual(['maths']);
  });

  it('orders them the way the app lists them, whatever order they arrive in', () => {
    expect(parseSubjects(['english', 'maths'], AVAILABLE)).toEqual(['maths', 'english']);
  });

  it('drops a repeat', () => {
    expect(parseSubjects(['maths', 'maths'], AVAILABLE)).toEqual(['maths']);
  });

  it('refuses an empty choice, so "at least one" is decided here', () => {
    expect(parseSubjects([], AVAILABLE)).toBeNull();
  });

  it('refuses a choice left with nothing once the unknown ones go', () => {
    expect(parseSubjects(['astronomy'], AVAILABLE)).toBeNull();
  });
});

describe('subjectsAllowed', () => {
  it('is what the parent chose', () => {
    expect(subjectsAllowed(['english'], AVAILABLE)).toEqual(['english']);
  });

  it('drops a stored subject whose content has since gone', () => {
    expect(subjectsAllowed(['maths', 'astronomy'], AVAILABLE)).toEqual(['maths']);
  });

  /*
    A child whose row somehow reads empty gets every subject rather than an
    empty home screen - the same trade the play screen makes on a failed read,
    where an unweighted first question beats no question. A refused save is the
    parent's to see; a child arriving at a blank screen is not.
  */
  it('degrades to every subject rather than to nothing', () => {
    expect(subjectsAllowed([], AVAILABLE)).toEqual(['maths', 'english']);
  });
});
