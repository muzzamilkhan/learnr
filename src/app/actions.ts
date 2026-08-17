'use server';

import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { auth, SESSION_COOKIE_NAME, SESSION_COOKIE_OPTIONS } from '@/auth';
import { writeSelectedLevel } from '@/lib/records';
import { parseYearLevel } from '@/lib/curriculum';
import { parseAvatar } from '@/lib/avatars';
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

/**
 * The home screen's level picker is usable before this resolves — remembering the
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
 * ownership check has to happen in the query — which is why the `accounts`
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
function parseChildInput(name: string, avatar: string, level: string): ChildInput | null {
  const trimmed = name.trim();
  const parsedAvatar = parseAvatar(avatar);
  const parsedLevel = parseYearLevel(level);
  if (!trimmed || trimmed.length > 40 || !parsedAvatar || !parsedLevel) return null;
  return { name: trimmed, avatar: parsedAvatar, level: parsedLevel };
}

export async function createChildAction(
  name: string,
  avatar: string,
  level: string,
): Promise<boolean> {
  const parentId = await requireParentId();
  const input = parseChildInput(name, avatar, level);
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
): Promise<boolean> {
  const parentId = await requireParentId();
  const input = parseChildInput(name, avatar, level);
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
    return { error: "That code doesn't work — ask your grown-up for a new one." };
  }

  const store = await cookies();
  store.set(SESSION_COOKIE_NAME, redeemed.token, {
    ...SESSION_COOKIE_OPTIONS,
    expires: redeemed.expires,
  });

  revalidatePath('/');
  return null;
}
