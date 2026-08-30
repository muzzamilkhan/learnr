/**
 * Which subjects a child may practise.
 *
 * A parent picks them when they make the profile and can change them after, the
 * same way they set the level - and for the same reason, that a managed child's
 * course is theirs to decide. `parseSubjects` is the boundary, beside
 * `parseYearLevel`, `parseTarget` and `parsePhoto`: the list round-trips through
 * the browser, so nothing reaches the column that has not been through here.
 *
 * **Which subjects exist is derived from the shipped templates**, so it is passed
 * in rather than declared here - `src/lib` is the half that never reads content,
 * and `SUBJECT_ORDER` beside `compareSubjects` is about ordering rather than
 * about what has been written. `resolveInitialLevel` takes its levels the same
 * way.
 */
import { compareSubjects } from './curriculum';

const known = (values: string[], available: string[]): string[] =>
  [...new Set(values)]
    .filter((subject) => available.includes(subject))
    .sort(compareSubjects);

/**
 * A parent's choice, as the form submits it. Null when it names nothing that
 * exists - which is what makes "at least one subject" a property of this
 * boundary rather than a check every caller has to remember, in the same way a
 * level that is not a school year fails the whole save.
 */
export function parseSubjects(
  values: string[],
  available: string[],
): string[] | null {
  const subjects = known(values, available);
  return subjects.length > 0 ? subjects : null;
}

/**
 * What a stored list means on the way back out. Empty degrades to every subject
 * rather than to nothing: a child cannot be saved without one, so an empty list
 * is a database that disagrees with itself, and the honest answer to that is the
 * screen the child had before this feature - not a home screen with no cards on
 * it. A refused save is the parent's to see; a child stuck at a blank screen has
 * nobody to tell.
 */
export function subjectsAllowed(
  stored: string[],
  available: string[],
): string[] {
  const subjects = known(stored, available);
  return subjects.length > 0 ? subjects : [...available].sort(compareSubjects);
}
