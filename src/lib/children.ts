/**
 * Which child a screen is about, and on what footing.
 *
 * The id round-trips through the browser, so it is never trusted: it is resolved
 * against a list the caller has already scoped - by `parentId` for a child they
 * own, by a grant for one shared with them - and anything not in that list falls
 * back to the first child rather than erroring. Both the progress page and the
 * heading above it read the same parameter, and this is the one place the answer
 * is worked out so the two cannot disagree.
 */
export function resolveChild<T extends { id: string }>(
  profiles: T[],
  id: string | null | undefined,
): T | null {
  return profiles.find((candidate) => candidate.id === id) ?? profiles[0] ?? null;
}

/**
 * How someone comes to be looking at a child: they own the profile, or another
 * parent shared it with them. Everything a screen offers keys off this, and it is
 * never a claim the browser gets to make - it comes back from the query that
 * found the child in the first place.
 */
export type ChildAccess = 'owner' | 'viewer';

/**
 * The children someone may look at, own ones first.
 *
 * Order is the point of this function: a parent's own children are the ones they
 * came to see and the ones they can act on, so a shared child never sorts above
 * them however it is named. Within each group the caller's order is kept.
 */
export function mergeViewable<T>(owned: T[], shared: T[]): (T & { access: ChildAccess })[] {
  return [
    ...owned.map((child) => ({ ...child, access: 'owner' as const })),
    ...shared.map((child) => ({ ...child, access: 'viewer' as const })),
  ];
}

/** One grant, as the database hands it back: who can see which child. */
export interface ShareRow {
  childId: string;
  childName: string;
  viewerId: string;
  viewerName: string | null;
  viewerEmail: string | null;
  viewerImage: string | null;
}

/** Everyone a parent has shared with, and what each of them can see. */
export interface SharedViewer {
  id: string;
  name: string | null;
  email: string | null;
  image: string | null;
  children: { id: string; name: string }[];
}

/**
 * Grants, grouped by the person holding them.
 *
 * Sharing is about people rather than about one child - a parent thinks "my ex
 * can see both of them", not "Ada is shared, and also Bo is shared" - so the
 * panel lists a person once with their children under them. First appearance
 * decides the order, so the list is stable against a grant being added.
 */
export function groupViewers(rows: ShareRow[]): SharedViewer[] {
  const viewers = new Map<string, SharedViewer>();

  for (const row of rows) {
    const existing = viewers.get(row.viewerId);
    if (existing) {
      existing.children.push({ id: row.childId, name: row.childName });
      continue;
    }
    viewers.set(row.viewerId, {
      id: row.viewerId,
      name: row.viewerName,
      email: row.viewerEmail,
      image: row.viewerImage,
      children: [{ id: row.childId, name: row.childName }],
    });
  }

  return [...viewers.values()];
}
