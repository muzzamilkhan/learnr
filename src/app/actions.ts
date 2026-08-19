'use server';

import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { auth, SESSION_COOKIE_NAME, SESSION_COOKIE_OPTIONS } from '@/auth';
import { writeSelectedLevel } from '@/lib/records';
import { parseYearLevel } from '@/lib/curriculum';
import { parseAvatar } from '@/lib/avatars';
import { parseTarget } from '@/lib/rewards/target';
import { parsePhoto } from '@/lib/photo/photo';
import {
  chooseRole,
  createChild,
  issueLoginCode,
  readAccount,
  redeemLoginCode,
  removeChild,
  updateChild,
  type ChildInput,
  type Role,
} from '@/lib/accounts';
import {
  acceptShareInvite,
  cancelShareInvite,
  createShareInvite,
  leaveShare,
  revokeShare,
  type AcceptResult,
} from '@/lib/sharing';

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

  await writeSelectedLevel(session.user.id, parsed);
}

/**
 * The one-time role choice. `chooseRole` refuses to overwrite an existing role, so
 * this cannot be replayed into a change however it is called.
 */
export async function chooseRoleAction(role: Role): Promise<void> {
  if (role !== 'parent' && role !== 'child') return;

  const session = await auth();
  if (!session?.user?.id) return;

  await chooseRole(session.user.id, role);
  revalidatePath('/');
}

/**
 * Every parent action goes through this first. The child id arrives from the
 * browser, so the parent's identity has to come from the session and the
 * ownership check has to happen in the query - which is why the `accounts`
 * functions all take `parentId` rather than trusting a check made up here.
 */
async function requireParentId(): Promise<string | null> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return null;

  const account = await readAccount(userId);
  return account?.role === 'parent' ? userId : null;
}

/** A child's details as the dashboard form submits them, before they are trusted. */
function parseChildInput(
  name: string,
  avatar: string,
  level: string,
  targetKind: string,
  targetValue: string,
  photo: string | null,
): ChildInput | null {
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
    target,
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
): Promise<boolean> {
  const parentId = await requireParentId();
  const input = parseChildInput(name, avatar, level, targetKind, targetValue, photo);
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

  const code = await issueLoginCode(parentId, childId);
  revalidatePath('/');
  return code;
}

/**
 * The child's way in. Signs them in by writing the same `Session` row and cookie
 * the Google path produces, so nothing downstream can tell the two apart.
 *
 * Returns a message rather than throwing: a mistyped code is the expected case,
 * not an error, and the child needs to read something they can act on.
 */
export async function redeemLoginCodeAction(code: string): Promise<{ error: string } | null> {
  const redeemed = await redeemLoginCode(code);
  if (!redeemed) {
    return { error: "That code doesn't work - ask your grown-up for a new one." };
  }

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
 * Every one of these goes through `requireParentId` like the rest, and then hands
 * the parent's own id to a query that scopes by it - a viewer reaching one of
 * these actions with a child id they can see is refused by the `where`, not by a
 * check written here. The one exception is `acceptShareInviteAction`, which is the
 * only action a person who owns nothing may call, and which scopes itself by the
 * token instead.
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
