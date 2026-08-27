'use server';

import { cookies, headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { auth, SESSION_COOKIE_NAME, SESSION_COOKIE_OPTIONS } from '@/auth';
import { api, type ChildBody } from '@/api';
import { readViewer } from '@/app/viewer';
import { parseYearLevel } from '@/lib/curriculum';
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
  if (!session?.user?.id) return;

  await api.writeLevel(parsed);
}

/**
 * Every parent action goes through this first, and it is now a courtesy rather
 * than the guard.
 *
 * The child id arrives from the browser, so the parent's identity has to come
 * from the session and the ownership check has to happen in the `where` - which
 * is exactly what the API does, scoping every child mutation by the `parentId`
 * it resolved from the session cookie itself. This one refuses early so a child
 * or a signed-out caller costs no round trip, and so these actions keep
 * answering `false` rather than whatever a 403 would look like. It is not the
 * thing standing between one family and another's child; that is the endpoint.
 */
async function requireParentId(): Promise<string | null> {
  const { userId, account } = await readViewer();
  return userId && account?.role === 'parent' ? userId : null;
}

/**
 * A child's details as the dashboard form submits them, before they are trusted.
 *
 * The API parses all of this again - `parseAvatar`, `parseTarget` and
 * `parsePhoto` are the same boundary functions on the far side, and it is the
 * far side that decides what may be stored. What this buys is the *form's*
 * answer: a refused save that says nothing worked, without a round trip, and
 * the one rule the endpoint cannot have, which is that "no goal" is a choice a
 * parent makes rather than a target that failed to parse.
 */
function parseChildInput(
  name: string,
  avatar: string,
  level: string,
  targetKind: string,
  targetValue: string,
  photo: string | null,
): ChildBody | null {
  const trimmed = name.trim();
  const parsedAvatar = parseAvatar(avatar);
  const parsedLevel = parseYearLevel(level);
  if (!trimmed || trimmed.length > 40 || !parsedAvatar || !parsedLevel) return null;

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
    // Two loose columns on the wire, a `DailyTarget` on either side of it. The
    // endpoint pairs them back up through `parseTarget` and refuses half a
    // target, which is why they are only ever sent together.
    targetKind: target?.kind ?? null,
    targetValue: target?.value ?? null,
  };
}

export async function createChildAction(
  name: string,
  avatar: string,
  level: string,
  targetKind: string,
  targetValue: string,
  photo: string | null,
): Promise<boolean> {
  const parentId = await requireParentId();
  const input = parseChildInput(name, avatar, level, targetKind, targetValue, photo);
  if (!parentId || !input) return false;

  const created = await api.createChild(input);
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
): Promise<boolean> {
  const parentId = await requireParentId();
  const input = parseChildInput(name, avatar, level, targetKind, targetValue, photo);
  if (!parentId || !input) return false;

  const updated = await api.updateChild(childId, input);
  revalidatePath('/');
  return updated;
}

export async function removeChildAction(childId: string): Promise<boolean> {
  const parentId = await requireParentId();
  if (!parentId) return false;

  const removed = await api.removeChild(childId);
  revalidatePath('/');
  return removed;
}

/** Returns the code to read out. A new code replaces whatever the child had. */
export async function issueLoginCodeAction(childId: string): Promise<string | null> {
  const parentId = await requireParentId();
  if (!parentId) return null;

  const issued = await api.issueLoginCode(childId);
  revalidatePath('/');
  return issued?.code ?? null;
}

/**
 * Failed redemptions, per browser.
 *
 * **This is the primary limit on guessing a login code**, and it lives here
 * rather than in the API because this is the only place the child's own address
 * is visible: `api.redeem` is called server-side, so every browser-typed code
 * reaches the API from Vercel and shares one key there. The API's
 * `REDEEM_BACKSTOP_LIMIT` is the backstop behind this, deliberately generous
 * for that reason.
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
 * The child's way in. The API writes the same `Session` row the Prisma adapter
 * would and this sets the same cookie, so `auth()` cannot tell the two paths
 * apart - which is the whole reason `SESSION_COOKIE_NAME` is pinned in
 * `auth.ts` rather than left to Auth.js to switch implicitly.
 *
 * The one action here that needs no session, because the code *is* the
 * credential: `POST /auth/redeem` spends it in the statement that reads it, so
 * two taps cannot both get a session.
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
  // every child at once. The API's own backstop still covers that case.
  if (browser && redeemFailures.blocked(browser, now)) {
    return { error: 'Too many tries - wait a few minutes and have another go.' };
  }

  const redeemed = await api.redeem(code);
  if (!redeemed) {
    if (browser) redeemFailures.fail(browser, now);
    return { error: "That code doesn't work - ask your grown-up for a new one." };
  }

  if (browser) redeemFailures.clear(browser);

  const store = await cookies();
  store.set(SESSION_COOKIE_NAME, redeemed.token, {
    ...SESSION_COOKIE_OPTIONS,
    expires: redeemed.expiresAt,
  });

  revalidatePath('/');
  return null;
}

/**
 * Sharing a child with another grown-up.
 *
 * Every one of these goes through `requireParentId` like the rest, and the
 * endpoint behind it scopes its `where` by the parent it resolved from the
 * session - a viewer reaching one of these with a child id they can see is
 * refused by that `where`, not by a check written here or there. The one
 * exception is `acceptShareInviteAction`, which is the only action a person who
 * owns nothing may call, and which is scoped by the token instead.
 */
export async function createShareInviteAction(childIds: string[]): Promise<string | null> {
  const parentId = await requireParentId();
  if (!parentId || childIds.length === 0) return null;

  const invite = await api.createShare(childIds);
  revalidatePath('/children');
  return invite?.token ?? null;
}

export async function cancelShareInviteAction(inviteId: string): Promise<boolean> {
  const parentId = await requireParentId();
  if (!parentId) return false;

  const cancelled = await api.cancelShare(inviteId);
  revalidatePath('/children');
  return cancelled;
}

/** One child of theirs, or - with no child id - everything that person can see. */
export async function revokeShareAction(viewerId: string, childId?: string): Promise<boolean> {
  const parentId = await requireParentId();
  if (!parentId) return false;

  const revoked = await api.revokeShare(viewerId, childId);
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

  const left = await api.leaveShare(childId);
  revalidatePath('/children');
  revalidatePath('/progress');
  return left;
}

/**
 * Take a link. The one action here that anyone signed in may call, because the
 * person calling it has by definition never had access to anything yet - the
 * token is what authorises it, and the endpoint spends the token in the same
 * statement that reads it.
 *
 * A failed call is `reason: 'error'` rather than null: this returns a result the
 * page renders a sentence from, and "we could not reach the server" and "that
 * link did not work" are the same sentence to the person holding the link.
 */
export async function acceptShareInviteAction(token: string): Promise<AcceptResult> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return { ok: false, reason: 'error' };

  const result = (await api.acceptShare(token)) ?? { ok: false as const, reason: 'error' as const };
  if (result.ok) {
    revalidatePath('/');
    revalidatePath('/children');
    revalidatePath('/progress');
  }
  return result;
}
