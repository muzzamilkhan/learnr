'use server';

import { cookies, headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { auth, SESSION_COOKIE_NAME, SESSION_COOKIE_OPTIONS } from '@/auth';
import {
  createChild,
  issueLoginCode,
  redeemLoginCode,
  removeChild,
  updateChild,
  type ChildInput,
} from '@/server/accounts';
import { writeSelectedLevel } from '@/server/records';
import {
  acceptShareInvite,
  cancelShareInvite,
  createShareInvite,
  leaveShare,
  revokeShare,
} from '@/server/sharing';
import { readViewer } from '@/app/viewer';
import { availableSubjects } from '@/content/catalog';
import { parseYearLevel } from '@/lib/curriculum';
import { parseSubjects } from '@/lib/subjects';
import { parseAvatar } from '@/lib/avatars';
import { parseTarget } from '@/lib/rewards/target';
import { browserIp, createThrottle } from '@/lib/throttle';
import { REDEEM_FAILURE_LIMIT, REDEEM_FAILURE_WINDOW_MS } from '@/lib/login-code';
import { parsePhoto } from '@/lib/photo/photo';
import type { AcceptResult } from '@/lib/dto';

/**
 * The home screen's level picker is usable before this resolves - remembering the
 * choice is a convenience, so a signed-out child or a failed write costs the
 * memory, not the pick.
 */
export async function saveSelectedLevelAction(level: string): Promise<void> {
  const parsed = parseYearLevel(level);
  if (!parsed) return;

  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return;

  await writeSelectedLevel(userId, parsed);
}

/**
 * Every parent action goes through this first, and it is a courtesy rather than
 * the guard.
 *
 * The child id arrives from the browser, so the parent's identity has to come
 * from the session and the ownership check has to happen in the `where` - which
 * is what every mutation in `src/server/accounts.ts` does, scoping by the
 * `parentId` this resolved. This one refuses early so a child or a signed-out
 * caller never reaches a mutation at all, and so these actions keep answering
 * `false`. It is not the thing standing between one family and another's child;
 * that is the `where`.
 */
async function requireParentId(): Promise<string | null> {
  const { userId, account } = await readViewer();
  return userId && account?.role === 'parent' ? userId : null;
}

/**
 * A child's details as the dashboard form submits them, before they are trusted.
 *
 * `parseAvatar`, `parseTarget` and `parsePhoto` are the boundary functions that
 * decide what may be stored, and this is where they run - once, rather than once
 * on each side of a wire. `createChild` and `updateChild` take the parsed shapes,
 * so a value that does not parse cannot reach them at all. The one rule that is
 * this form's and not the store's is that "no goal" is a choice a parent makes
 * rather than a target that failed to parse.
 */
function parseChildInput(
  name: string,
  avatar: string,
  level: string,
  targetKind: string,
  targetValue: string,
  photo: string | null,
  subjects: string[],
): ChildInput | null {
  const trimmed = name.trim();
  const parsedAvatar = parseAvatar(avatar);
  const parsedLevel = parseYearLevel(level);

  // Which subjects exist is derived from the shipped templates, so the catalog
  // is what the choice is checked against - and a choice naming none of them
  // fails the whole save, exactly as a level that is not a school year does.
  // "At least one subject" is decided in `parseSubjects` and nowhere else.
  const parsedSubjects = parseSubjects(subjects, availableSubjects());
  if (!trimmed || trimmed.length > 40 || !parsedAvatar || !parsedLevel || !parsedSubjects) {
    return null;
  }

  // "No goal" is a choice a parent makes, so it is a valid input that clears the
  // target - and a target that fails to parse is refused outright rather than
  // quietly saved as no target, which would tell a parent they set one.
  const target = targetKind === 'none' ? null : parseTarget(targetKind, targetValue);
  if (targetKind !== 'none' && target === null) return null;

  // A photo that doesn't parse is no photo, and never a refused save: the
  // picture is the smallest thing on the form, and losing a name, a level and a
  // goal over a browser that encoded a face oddly is the wrong trade. `parsePhoto`
  // is the only thing that decides what may be stored, here as everywhere.
  return {
    name: trimmed,
    avatar: parsedAvatar,
    photo: parsePhoto(photo),
    level: parsedLevel,
    target,
    subjects: parsedSubjects,
  };
}

export async function createChildAction(
  name: string,
  avatar: string,
  level: string,
  targetKind: string,
  targetValue: string,
  photo: string | null,
  subjects: string[],
): Promise<boolean> {
  const parentId = await requireParentId();
  const input = parseChildInput(name, avatar, level, targetKind, targetValue, photo, subjects);
  if (!parentId || !input) return false;

  const created = await createChild(parentId, input);
  revalidatePath('/');
  return created !== null;
}

export async function updateChildAction(
  childId: string,
  name: string,
  avatar: string,
  level: string,
  targetKind: string,
  targetValue: string,
  photo: string | null,
  subjects: string[],
): Promise<boolean> {
  const parentId = await requireParentId();
  const input = parseChildInput(name, avatar, level, targetKind, targetValue, photo, subjects);
  if (!parentId || !input) return false;

  const updated = await updateChild(parentId, childId, input);
  revalidatePath('/');
  return updated;
}

export async function removeChildAction(childId: string): Promise<boolean> {
  const parentId = await requireParentId();
  if (!parentId) return false;

  const removed = await removeChild(parentId, childId);
  revalidatePath('/');
  return removed;
}

/** Returns the code to read out. A new code replaces whatever the child had. */
export async function issueLoginCodeAction(childId: string): Promise<string | null> {
  const parentId = await requireParentId();
  if (!parentId) return null;

  const issued = await issueLoginCode(parentId, childId);
  revalidatePath('/');
  return issued;
}

/**
 * Failed redemptions, per browser.
 *
 * **This is the limit on guessing a login code.** The charset is 31 characters
 * and the code is 4, which is 923,521 codes; `redeemLoginCode` matches *any*
 * live code rather than one child's, so a guesser is attacking the pool of
 * every code out at that moment; and a hit buys a session that never expires.
 * The hour-long window and single-use redemption were always the argument for
 * why four characters is safe, and an unbounded number of guesses is what would
 * retire it.
 *
 * **Best-effort, and the cost is written down rather than hidden.** This module
 * runs in a Vercel Function, so the map is per-instance and per-lifetime: a
 * guesser spread across instances gets more than `REDEEM_FAILURE_LIMIT` tries
 * per window, and a cold start forgets. It raises the cost of guessing by a
 * large factor without being a wall, which against a 923,521-code space and an
 * hour-long window is the trade being made. A shared store is what would make
 * it a wall, and it is not worth a dependency at this size.
 */
const redeemFailures = createThrottle({
  limit: REDEEM_FAILURE_LIMIT,
  windowMs: REDEEM_FAILURE_WINDOW_MS,
});

/**
 * The child's way in. `redeemLoginCode` writes the same `Session` row the Prisma
 * adapter would and this sets the same cookie, so `auth()` cannot tell the two
 * paths apart - which is the whole reason `SESSION_COOKIE_NAME` is pinned in
 * `auth.ts` rather than left to Auth.js to switch implicitly.
 *
 * The one action here that needs no session, because the code *is* the
 * credential: it is spent in the statement that reads it, so two taps cannot
 * both get a session.
 *
 * Returns a message rather than throwing: a mistyped code is the expected case,
 * not an error, and the child needs to read something they can act on.
 */
export async function redeemLoginCodeAction(code: string): Promise<{ error: string } | null> {
  const bag = await headers();
  const browser = browserIp(bag.get('x-real-ip'), bag.get('x-forwarded-for'));
  const now = Date.now();

  // An unattributable request is let through rather than sharing a key with
  // every other one: a single key here is not a throttle, it is a lockout of
  // every child in the service at once, which is worse than the guessing it
  // would prevent.
  if (browser && redeemFailures.blocked(browser, now)) {
    return { error: 'Too many tries - wait a few minutes and have another go.' };
  }

  const redeemed = await redeemLoginCode(code);
  if (!redeemed) {
    if (browser) redeemFailures.fail(browser, now);
    return { error: "That code doesn't work - ask your grown-up for a new one." };
  }

  if (browser) redeemFailures.clear(browser);

  const store = await cookies();
  store.set(SESSION_COOKIE_NAME, redeemed.token, {
    ...SESSION_COOKIE_OPTIONS,
    expires: redeemed.expires,
  });

  revalidatePath('/');
  return null;
}

/**
 * Sharing a child with another grown-up.
 *
 * Every one of these goes through `requireParentId` like the rest, and the read
 * behind it scopes its `where` through the child, which is where ownership lives
 * - a viewer reaching one of these with a child id they can see is refused by
 * that `where`, not by a check written here or there. The one exception is
 * `acceptShareInviteAction`, which is the only action a person who owns nothing
 * may call, and which is scoped by the token instead.
 */
export async function createShareInviteAction(childIds: string[]): Promise<string | null> {
  const parentId = await requireParentId();
  if (!parentId || childIds.length === 0) return null;

  const invite = await createShareInvite(parentId, childIds);
  revalidatePath('/children');
  return invite?.token ?? null;
}

export async function cancelShareInviteAction(inviteId: string): Promise<boolean> {
  const parentId = await requireParentId();
  if (!parentId) return false;

  const cancelled = await cancelShareInvite(parentId, inviteId);
  revalidatePath('/children');
  return cancelled;
}

/** One child of theirs, or - with no child id - everything that person can see. */
export async function revokeShareAction(viewerId: string, childId?: string): Promise<boolean> {
  const parentId = await requireParentId();
  if (!parentId) return false;

  const revoked = await revokeShare(parentId, viewerId, childId);
  revalidatePath('/children');
  revalidatePath('/progress');
  return revoked;
}

/**
 * A viewer giving up access they were given. Not a parent action: it needs no
 * ownership at all, only that the grant being dropped is their own.
 */
export async function leaveShareAction(childId: string): Promise<boolean> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return false;

  const left = await leaveShare(userId, childId);
  revalidatePath('/children');
  revalidatePath('/progress');
  return left;
}

/**
 * Take a link. The one action here that anyone signed in may call, because the
 * person calling it has by definition never had access to anything yet - the
 * token is what authorises it, and `acceptShareInvite` spends the token in the
 * same statement that reads it.
 *
 * A failed read is `reason: 'error'` rather than null: this returns a result the
 * page renders a sentence from, and "something is down at our end" and "that
 * link did not work" are the same sentence to the person holding the link.
 */
export async function acceptShareInviteAction(token: string): Promise<AcceptResult> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return { ok: false, reason: 'error' };

  const result = await acceptShareInvite(token, userId);
  if (result.ok) {
    revalidatePath('/');
    revalidatePath('/children');
    revalidatePath('/progress');
  }
  return result;
}
