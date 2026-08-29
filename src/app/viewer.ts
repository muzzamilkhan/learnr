import { cache } from 'react';
import type { Session } from 'next-auth';
import { auth, isAuthConfigured } from '@/auth';
import { readAccount } from '@/server/accounts';
import { viewerKind, type ViewerKind } from '@/lib/viewer';
import type { Account } from '@/lib/dto';

export interface Viewer {
  session: Session | null;
  userId: string | undefined;
  account: Account | null;
  /**
   * What the two above *mean* - see `viewerKind`. Branch on this rather than on
   * `account?.role`, which cannot tell a visitor from a parent whose account
   * could not be read.
   */
  kind: ViewerKind;
}

/**
 * Who is asking, read once per request.
 *
 * Several screens want it two or three times over - `/` reads it, and so does
 * the `SpeedScores` it renders. Neon is a network hop whichever process asks, so
 * it is `cache`d: React de-duplicates within one request without holding
 * anything across them.
 *
 * It lives here rather than beside the read in `src/server` because `cache` is
 * React's, and neither `src/lib` nor `src/server` may touch React. It used to
 * live in `(parent)/parent.ts`, which is where `readParent` still is - but a
 * route group is the wrong home for something the child's home screen and a
 * shared component both read.
 *
 * It decides nothing. `readParent` is a *gate* - it redirects anyone who is not
 * a parent - and that is the right shape for a screen only a parent has any
 * business on. `/` and `/speed` serve two kinds of reader and have to *ask* the
 * role rather than be bounced on it, so they come through here.
 *
 * **`account` is null for two different things**, which is why `kind` is here.
 * A visitor who is signed out and a parent whose account could not be read both
 * arrive as null. Neon is a network hop, so a read can fail while this app
 * renders perfectly well, and reading that as "not a parent" would put a
 * grown-up on the child's home screen. Telling the two apart is `viewerKind`'s
 * whole job.
 */
export const readViewer = cache(async (): Promise<Viewer> => {
  const session = isAuthConfigured ? await auth() : null;
  const userId = session?.user?.id;
  const account = userId ? await readAccount(userId) : null;

  return { session, userId, account, kind: viewerKind(userId, account) };
});
