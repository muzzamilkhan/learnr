import { cache } from 'react';
import { redirect } from 'next/navigation';
import type { Session } from 'next-auth';
import { auth, isAuthConfigured } from '@/auth';
import { readAccount, type Account, type ChildProfile } from '@/lib/accounts';
import { readViewableChildren, type ViewableChild } from '@/lib/sharing';

export interface ParentContext {
  userId: string;
  name: string | null;
  image: string | null;
  /**
   * Every child this parent may look at: their own first, then any another
   * parent has shared with them. What a screen *offers* keys off `access` -
   * editing, codes and removal belong to an owner - and what a screen *resolves
   * `?child=` against* is this whole list, so a shared child's report is
   * reachable and nothing else about them is.
   */
  viewable: ViewableChild[] | null;
  /** The children they own, which is the only set any mutation applies to. */
  profiles: ChildProfile[] | null;
}

export interface Viewer {
  session: Session | null;
  userId: string | undefined;
  account: Account | null;
}

/**
 * Who is asking, without deciding anything about it.
 *
 * `readParent` below is a gate - it redirects anyone who is not a parent - and
 * that is the right shape for a screen only a parent has any business on. The
 * unified `/speed` is not one of those: it serves a parent and sends a child on
 * to their own speed screen, so it has to *ask* the role rather than be bounced
 * on it. Both go through here and both are `cache`d, so a parent landing on
 * `/speed` reads their account once and not once per caller.
 */
export const readViewer = cache(async (): Promise<Viewer> => {
  const session = isAuthConfigured ? await auth() : null;
  const userId = session?.user?.id;
  return { session, userId, account: userId ? await readAccount(userId) : null };
});

/**
 * Who is asking, and who they may look at.
 *
 * The layout and the page under it both need this, and both run in the same
 * request, so it is read once and shared: `cache` de-duplicates within a request
 * without caching anything across them. It lives here rather than in
 * `src/lib/accounts.ts` because `cache` is React's, and nothing in `src/lib`
 * touches React.
 *
 * The two lists come from one read rather than two queries for the same rows:
 * owned children are the `access: 'owner'` half of the viewable list, so the two
 * cannot disagree about what this parent owns.
 *
 * The role check is repeated by each page rather than left to the layout alone:
 * a layout does not re-run on a client-side hop between the two screens, so it
 * is a frame, not a gate.
 */
export const readParent = cache(async (): Promise<ParentContext> => {
  const { session, userId, account } = await readViewer();
  if (!userId) redirect('/');

  // A child must not reach these screens, and neither must an account that has
  // not said what kind it is yet.
  if (account?.role !== 'parent') redirect('/');

  const viewable = await readViewableChildren(userId);

  return {
    userId,
    name: session?.user?.name ?? null,
    image: session?.user?.image ?? null,
    viewable,
    profiles: viewable?.filter((child) => child.access === 'owner') ?? null,
  };
});
