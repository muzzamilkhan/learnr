import { cache } from 'react';
import type { Session } from 'next-auth';
import { auth, isAuthConfigured } from '@/auth';
import { api } from '@/api';
import type { Account } from '@/lib/dto';

export interface Viewer {
  session: Session | null;
  userId: string | undefined;
  account: Account | null;
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
 * `account` is null for a visitor who is signed out *and* for a read that
 * failed: every caller has a signed-out branch already, and none of them can do
 * anything useful with an account they could not read.
 */
export const readViewer = cache(async (): Promise<Viewer> => {
  const session = isAuthConfigured ? await auth() : null;
  const userId = session?.user?.id;
  return { session, userId, account: userId ? await api.me() : null };
});
