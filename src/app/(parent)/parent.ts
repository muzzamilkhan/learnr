import { cache } from 'react';
import { redirect } from 'next/navigation';
import { auth, isAuthConfigured } from '@/auth';
import { listChildren, readAccount, type ChildProfile } from '@/lib/accounts';

export interface ParentContext {
  userId: string;
  name: string | null;
  image: string | null;
  /** Null means the read failed - different from a parent with no children yet. */
  profiles: ChildProfile[] | null;
}

/**
 * Who is asking, and who their children are.
 *
 * The layout and the page under it both need this, and both run in the same
 * request, so it is read once and shared: `cache` de-duplicates within a request
 * without caching anything across them. It lives here rather than in
 * `src/lib/accounts.ts` because `cache` is React's, and nothing in `src/lib`
 * touches React.
 *
 * The role check is repeated by each page rather than left to the layout alone:
 * a layout does not re-run on a client-side hop between the two screens, so it
 * is a frame, not a gate.
 */
export const readParent = cache(async (): Promise<ParentContext> => {
  const session = isAuthConfigured ? await auth() : null;
  const userId = session?.user?.id;
  if (!userId) redirect('/');

  // A child must not reach these screens, and neither must an account that has
  // not said what kind it is yet.
  const account = await readAccount(userId);
  if (account?.role !== 'parent') redirect('/');

  return {
    userId,
    name: session?.user?.name ?? null,
    image: session?.user?.image ?? null,
    profiles: await listChildren(userId),
  };
});
