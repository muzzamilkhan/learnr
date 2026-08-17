/**
 * Which child a screen is about.
 *
 * The id round-trips through the browser, so it is never trusted: it is resolved
 * against a list the caller has already scoped by `parentId`, and anything not
 * in that list falls back to the first child rather than erroring. Both the
 * progress page and the heading above it read the same parameter, and this is
 * the one place the answer is worked out so the two cannot disagree.
 */
export function resolveChild<T extends { id: string }>(
  profiles: T[],
  id: string | null | undefined,
): T | null {
  return profiles.find((candidate) => candidate.id === id) ?? profiles[0] ?? null;
}
