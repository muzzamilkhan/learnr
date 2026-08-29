import { cache } from 'react';
import type { Session } from 'next-auth';
import { auth, isAuthConfigured } from '@/auth';
import { api } from '@/api';
import { viewerKind, type ViewerKind } from '@/lib/viewer';
import { timed } from '@/timing';
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
 * Reading the account used to be a Prisma query, cheap enough that several
 * screens made it two or three times over - `/` reads it, and so does the
 * `SpeedScores` it renders. Over the wire that is a round trip each, so it is
 * `cache`d: React de-duplicates within one request without holding anything
 * across them.
 *
 * It lives here rather than beside the client in `src/api.ts` because `cache`
 * is React's, and neither `src/lib` nor the client may touch React. It used to
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
 * arrive as null, and while the database was in-process that was one event -
 * a failed read meant the whole app was down. With the record behind an API it
 * is two, and telling them apart is `viewerKind`'s whole job.
 */
export const readViewer = cache(async (): Promise<Viewer> => {
  // Timed on its own because it is the hop nothing else reports. `auth()` is a
  // Prisma query from Vercel to Neon that resolves the session cookie - and the
  // API resolves that same cookie against that same table again on the far side
  // of `api.me()`, so a signed-in page load pays for the lookup twice before it
  // has read anything at all.
  const session = isAuthConfigured ? await timed('auth()', async () => auth()) : null;
  const userId = session?.user?.id;
  const account = userId ? await api.me() : null;

  return { session, userId, account, kind: viewerKind(userId, account) };
});
