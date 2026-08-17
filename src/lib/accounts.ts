import 'server-only';
import { randomInt, randomUUID } from 'node:crypto';
import { prisma } from './db';
import { parseAvatar, type Avatar } from './avatars';
import { codeExpiry, generateLoginCode, normaliseCode } from './login-code';
import type { YearLevel } from './curriculum';

/**
 * Accounts: who a signed-in user is, the child profiles a parent manages, and the
 * code path a child signs in by.
 *
 * Follows `records.ts`: Prisma lives here rather than in the pure libraries, every
 * write that touches a child is ownership-checked against the parent asking for it,
 * and reads degrade to a sensible empty rather than throwing into a page render.
 *
 * Unlike `records.ts` these are *not* best-effort. Recording an answer can fail
 * silently because the child keeps playing either way; a login that silently fails
 * is a child locked out, and a "remove child" that silently fails is a parent lied
 * to. So the mutations report whether they worked.
 */

export type Role = 'parent' | 'child';

export function parseRole(value: string | null | undefined): Role | null {
  return value === 'parent' || value === 'child' ? value : null;
}

/** Who the signed-in user is, as every branch of the home screen needs it. */
export interface Account {
  id: string;
  role: Role | null;
  /** Set only on a child profile a parent created — the flag that fixes the level. */
  parentId: string | null;
  name: string | null;
  avatar: Avatar | null;
  image: string | null;
}

export async function readAccount(userId: string): Promise<Account | null> {
  if (!prisma) return null;
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, role: true, parentId: true, name: true, avatar: true, image: true },
    });
    if (!user) return null;
    return {
      id: user.id,
      role: parseRole(user.role),
      parentId: user.parentId,
      name: user.name,
      avatar: parseAvatar(user.avatar),
      image: user.image,
    };
  } catch (error) {
    console.error('Failed to read account', error);
    return null;
  }
}

/**
 * Take the one-time role choice. A compare-and-set on `role IS NULL`, so the
 * choice is permanent in the database rather than only in the UI that offers it:
 * replaying the action later changes nothing.
 */
export async function chooseRole(userId: string, role: Role): Promise<boolean> {
  if (!prisma) return false;
  try {
    const written = await prisma.user.updateMany({
      where: { id: userId, role: null },
      data: { role },
    });
    return written.count > 0;
  } catch (error) {
    console.error('Failed to choose role', error);
    return false;
  }
}

/** A child profile as the parent dashboard lists it. */
export interface ChildProfile {
  id: string;
  name: string;
  avatar: Avatar;
  /** Set by the parent at creation and only ever changed by them. */
  level: string | null;
  /** The live code, if one has been generated and not yet used or expired. */
  code: string | null;
  codeExpiresAt: Date | null;
}

/**
 * A parent's children, newest-created last. `null` means *could not read* and
 * `[]` means *no children yet* — the same distinction `readObservations` and
 * `readSittings` make, and for the same reason: an empty dashboard and a failed
 * read must not render the same, or a database hiccup tells a parent their
 * children are gone.
 */
export async function listChildren(parentId: string): Promise<ChildProfile[] | null> {
  if (!prisma) return [];
  try {
    const rows = await prisma.user.findMany({
      where: { parentId },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        name: true,
        avatar: true,
        selectedLevel: true,
        loginCode: true,
        loginCodeExpiresAt: true,
      },
    });
    return rows.map((row) => ({
      id: row.id,
      name: row.name ?? '',
      avatar: parseAvatar(row.avatar) ?? 'fox',
      level: row.selectedLevel,
      code: row.loginCode,
      codeExpiresAt: row.loginCodeExpiresAt,
    }));
  } catch (error) {
    console.error('Failed to list children', error);
    return null;
  }
}

export interface ChildInput {
  name: string;
  avatar: Avatar;
  level: YearLevel;
}

/**
 * A child profile is a `User` row with no email and no `Account` — there is
 * nothing OAuth about it, so everything downstream (sessions, attempts, skills)
 * treats it as the ordinary user it is.
 */
export async function createChild(parentId: string, input: ChildInput): Promise<string | null> {
  if (!prisma) return null;
  try {
    const child = await prisma.user.create({
      data: {
        parentId,
        role: 'child',
        name: input.name,
        avatar: input.avatar,
        selectedLevel: input.level,
      },
      select: { id: true },
    });
    return child.id;
  } catch (error) {
    console.error('Failed to create child', error);
    return null;
  }
}

/**
 * Every child mutation scopes its `where` by `parentId` as well as `id`, so a
 * parent can only ever reach their own children — the child id round-trips
 * through the browser and is never trusted on its own.
 */
export async function updateChild(
  parentId: string,
  childId: string,
  input: ChildInput,
): Promise<boolean> {
  if (!prisma) return false;
  try {
    const written = await prisma.user.updateMany({
      where: { id: childId, parentId },
      data: { name: input.name, avatar: input.avatar, selectedLevel: input.level },
    });
    return written.count > 0;
  } catch (error) {
    console.error('Failed to update child', error);
    return false;
  }
}

/** Cascades to the child's sessions, sittings and skills — the profile goes entirely. */
export async function removeChild(parentId: string, childId: string): Promise<boolean> {
  if (!prisma) return false;
  try {
    const removed = await prisma.user.deleteMany({ where: { id: childId, parentId } });
    return removed.count > 0;
  } catch (error) {
    console.error('Failed to remove child', error);
    return false;
  }
}

/** A generated code can collide with another child's live one; four goes is plenty. */
const CODE_ATTEMPTS = 4;

/** Postgres' unique violation, as Prisma reports it. */
const isUniqueViolation = (error: unknown): boolean =>
  typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002';

/**
 * Issue a fresh code for a child, replacing any code they already had. Generating
 * a second code invalidates the first by overwriting it, which is what a parent
 * means when they ask for a new one — the old slip of paper stops working.
 */
export async function issueLoginCode(
  parentId: string,
  childId: string,
  now = new Date(),
): Promise<string | null> {
  if (!prisma) return null;

  for (let tries = 0; tries < CODE_ATTEMPTS; tries += 1) {
    const code = generateLoginCode((max) => randomInt(max));
    try {
      const written = await prisma.user.updateMany({
        where: { id: childId, parentId },
        data: { loginCode: code, loginCodeExpiresAt: codeExpiry(now) },
      });
      return written.count > 0 ? code : null;
    } catch (error) {
      if (!isUniqueViolation(error)) {
        console.error('Failed to issue login code', error);
        return null;
      }
    }
  }

  console.error(`Gave up generating a login code after ${CODE_ATTEMPTS} tries`);
  return null;
}

/**
 * A code is spent at redemption, and the session it creates does not expire on a
 * schedule. Those are two halves of one decision: the short-lived thing is the
 * *code*, not the login. The hour-long window and single-use redemption protect
 * the handoff from parent to child; once the child is in, they stay in. Being
 * locked out of a maths app mid-term and having to find a parent to get back in
 * is the friction this whole feature exists to remove.
 *
 * `Session.expires` is not nullable, so "does not expire" is spelled as a date far
 * enough out that it will never be reached in practice.
 */
const SESSION_LIFETIME_MS = 100 * 365 * 24 * 60 * 60 * 1000;

/** The cookie the caller must set. Written here, set by the server action. */
export interface RedeemedSession {
  token: string;
  expires: Date;
}

/**
 * Exchange a code for a session.
 *
 * Spending the code and learning whose it was are one statement — `UPDATE ...
 * RETURNING` — rather than a read then a write. Two taps arriving together would
 * otherwise both find the code live and both get a session; here exactly one
 * update matches a row still holding that code, and the loser gets no row back.
 * A separate lookup after clearing could not identify the row at all, because the
 * only thing that identified it has just been erased.
 */
export async function redeemLoginCode(
  input: string,
  now = new Date(),
): Promise<RedeemedSession | null> {
  if (!prisma) return null;

  const code = normaliseCode(input);
  if (!code) return null;

  const db = prisma;
  try {
    return await db.$transaction(async (tx) => {
      const claimed = await tx.$queryRaw<{ id: string }[]>`
        UPDATE "User"
        SET "loginCode" = NULL, "loginCodeExpiresAt" = NULL
        WHERE "loginCode" = ${code} AND "loginCodeExpiresAt" > ${now}
        RETURNING "id"
      `;

      const child = claimed[0];
      if (!child) return null;

      const token = randomUUID();
      const expires = new Date(now.getTime() + SESSION_LIFETIME_MS);
      await tx.session.create({ data: { sessionToken: token, userId: child.id, expires } });
      return { token, expires };
    });
  } catch (error) {
    console.error('Failed to redeem login code', error);
    return null;
  }
}
