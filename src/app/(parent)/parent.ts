import { cache } from 'react';
import { redirect } from 'next/navigation';
import { api } from '@/api';
import type { ChildProfile, ViewableChild } from '@/lib/dto';
import { readViewer } from '@/app/viewer';

export { readViewer, type Viewer } from '@/app/viewer';

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

/**
 * Who is asking, and who they may look at.
 *
 * The layout and the page under it both need this, and both run in the same
 * request, so it is read once and shared: `cache` de-duplicates within a request
 * without caching anything across them - and the account read underneath it is
 * `cache`d too, in `src/app/viewer.ts`, so a parent landing on `/speed` reads it
 * once and not once per caller.
 *
 * The two lists come from one read rather than two calls for the same rows:
 * owned children are the `access: 'owner'` half of the viewable list, so the two
 * cannot disagree about what this parent owns.
 *
 * The role check is repeated by each page rather than left to the layout alone:
 * a layout does not re-run on a client-side hop between the two screens, so it
 * is a frame, not a gate.
 */
export const readParent = cache(async (): Promise<ParentContext> => {
  const { session, userId, kind } = await readViewer();
  if (!userId) redirect('/');

  const context = (viewable: ViewableChild[] | null): ParentContext => ({
    userId,
    name: session?.user?.name ?? null,
    image: session?.user?.image ?? null,
    viewable,
    profiles: viewable?.filter((child) => child.access === 'owner') ?? null,
  });

  /*
    An account that could not be read is **not** redirected, and that is the
    change worth naming. It used to fall into the check below and be bounced to
    `/` as though it were a child - which cost the URL, so a reload after the
    blip landed somewhere else instead of retrying the screen the parent was on.

    It returns nulls instead, which every page here already draws as
    "couldn't load your children just now" - the same shape a failed
    `viewableChildren` produces. There is nothing new for a page to handle and
    nothing to leak: with the API unreachable no read on these screens can
    return anything either.
  */
  if (kind === 'unreadable') return context(null);

  // A child must not reach these screens, and neither must an account whose role
  // has not been claimed yet - `/` claims it and sends them back, so the bounce
  // heals rather than loops.
  if (kind !== 'parent') redirect('/');

  return context(await api.viewableChildren());
});
