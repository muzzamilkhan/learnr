import type { Account } from './dto';

/**
 * What a screen knows about whoever is asking - which is four things, not two.
 *
 * Every screen used to work this out inline from `account?.role`, and that
 * expression cannot say the difference between a visitor with no account and a
 * parent whose account could not be read: both arrive as null. While the
 * database was in-process those two were the same event, because a failed read
 * meant the whole app was down. With the record behind an API they are not: the
 * API can be unreachable while the web app renders perfectly well, and a parent
 * would land on the child's home screen - a level picker and a row of subject
 * cards - as though they had never signed in.
 *
 * So the null is split, and the split lives here rather than in three screens:
 * it is the kind of small decision CLAUDE.md asks to sit in `lib` with a test
 * beside it, and a rule spelled out three times is a rule two of them can drift
 * from. `src/app/viewer.ts` is the request-scoped read that produces the two
 * arguments; this is what they mean.
 *
 * `unclaimed` is kept apart from `parent` for a reason of its own: `/` claims
 * the role and every other screen bounces there, so the bounce heals rather
 * than loops - which only works while the two are distinguishable.
 */
export type ViewerKind = 'signed-out' | 'unreadable' | 'unclaimed' | 'parent' | 'child';

export function viewerKind(userId: string | undefined, account: Account | null): ViewerKind {
  // Signed out wins over unreadable: with no user, no read was ever made, so
  // there is none to have failed.
  if (!userId) return 'signed-out';
  if (!account) return 'unreadable';
  if (account.role === null) return 'unclaimed';
  return account.role;
}
