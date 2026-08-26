import { randomInt, randomUUID } from 'node:crypto';
import { prisma } from '../db.js';
import { parseAvatar, type Avatar } from '@learnr/core/avatars';
import { codeExpiry, generateLoginCode, normaliseCode } from '@learnr/core/login-code';
import type { YearLevel } from '@learnr/core/curriculum';
import { parseTarget, type DailyTarget } from '@learnr/core/rewards/target';
import { parsePhoto } from '@learnr/core/photo/photo';
import type { Account, ChildProfile, Role } from '@learnr/core/dto';

// Declared once, in the package both apps depend on. Re-exported so every
// caller of this module keeps importing them from where it always did.
export type { Account, ChildProfile, Role };

export function parseRole(value: string | null | undefined): Role | null {
  return value === 'parent' || value === 'child' ? value : null;
}

export async function readAccount(userId: string): Promise<Account | null> {
  if (!prisma) return null;
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        role: true,
        parentId: true,
        name: true,
        avatar: true,
        image: true,
        photo: { select: { dataUrl: true } },
      },
    });
    if (!user) return null;
    return {
      id: user.id,
      role: parseRole(user.role),
      parentId: user.parentId,
      name: user.name,
      avatar: parseAvatar(user.avatar),
      image: user.image,
      photo: parsePhoto(user.photo?.dataUrl),
    };
  } catch (error) {
    console.error('Failed to read account', error);
    return null;
  }
}

/**
 * Claim the parent role for an account that has not got one yet. There is no
 * choice left to make: a Google sign-in is a grown-up by definition, because the
 * only way to become a child is a parent creating the profile and handing over a
 * login code. A self-declared child was an account nobody managed - `parentId`
 * null, so the level their parent set could not be enforced on them - and the one
 * shape of child the rest of the app does not describe.
 *
 * Still a compare-and-set on `role IS NULL`, which is the property that outlived
 * the chooser it was written for: a role already set is never overwritten, so an
 * account that predates this - a managed child included, though one can never
 * reach here - is not quietly promoted. `sharing.ts` writes the identical
 * statement inside its acceptance transaction, where it has to run on the same
 * connection.
 */
export async function claimParentRole(userId: string): Promise<boolean> {
  if (!prisma) return false;
  try {
    const written = await prisma.user.updateMany({
      where: { id: userId, role: null },
      data: { role: 'parent' },
    });
    return written.count > 0;
  } catch (error) {
    console.error('Failed to claim the parent role', error);
    return false;
  }
}

/**
 * A parent's children, newest-created last. `null` means *could not read* and
 * `[]` means *no children yet* - the same distinction `readObservations` and
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
        photo: { select: { dataUrl: true } },
        selectedLevel: true,
        targetKind: true,
        targetValue: true,
        loginCode: true,
        loginCodeExpiresAt: true,
      },
    });
    return rows.map((row) => ({
      id: row.id,
      name: row.name ?? '',
      avatar: parseAvatar(row.avatar) ?? 'fox',
      photo: parsePhoto(row.photo?.dataUrl),
      level: row.selectedLevel,
      target: parseTarget(row.targetKind, row.targetValue),
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
  /** Null clears the photograph, which is what "Remove photo" on the form means. */
  photo: string | null;
  level: YearLevel;
  /** Null clears the target, which is what "No goal" on the form means. */
  target: DailyTarget | null;
}

/**
 * A child profile is a `User` row with no email and no `Account` - there is
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
        targetKind: input.target?.kind ?? null,
        targetValue: input.target?.value ?? null,
        // A nested create, so the photograph lands in the same statement as the
        // row it belongs to: there is no moment where the child exists without
        // the face their parent just cropped, and nothing to clean up if the
        // create fails.
        photo: input.photo ? { create: { dataUrl: input.photo } } : undefined,
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
 * parent can only ever reach their own children - the child id round-trips
 * through the browser and is never trusted on its own.
 */
export async function updateChild(
  parentId: string,
  childId: string,
  input: ChildInput,
): Promise<boolean> {
  if (!prisma) return false;
  const db = prisma;
  try {
    return await db.$transaction(async (tx) => {
      const written = await tx.user.updateMany({
        where: { id: childId, parentId },
        data: {
          name: input.name,
          avatar: input.avatar,
          selectedLevel: input.level,
          targetKind: input.target?.kind ?? null,
          targetValue: input.target?.value ?? null,
        },
      });

      // The photograph is a second statement rather than a nested write, because
      // `updateMany` carries none - and it is gated on that update having matched
      // a row, so ownership is still the query and not a check made up here. Both
      // are in one transaction, so a child cannot end up wearing a face from a
      // save that otherwise failed.
      if (written.count === 0) return false;

      if (input.photo) {
        await tx.childPhoto.upsert({
          where: { childId },
          create: { childId, dataUrl: input.photo },
          update: { dataUrl: input.photo },
        });
      } else {
        // `deleteMany` rather than `delete`: clearing a photo the child never had
        // is what "no photo" means every other time it is saved, and it must not
        // be the one spelling of it that throws.
        await tx.childPhoto.deleteMany({ where: { childId } });
      }

      return true;
    });
  } catch (error) {
    console.error('Failed to update child', error);
    return false;
  }
}

/** Cascades to the child's sessions, sittings and skills - the profile goes entirely. */
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
 * means when they ask for a new one - the old slip of paper stops working.
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
  /** Whose session it is. The claiming UPDATE ... RETURNING already has it. */
  userId: string;
}

/**
 * Exchange a code for a session.
 *
 * Spending the code and learning whose it was are one statement - `UPDATE ...
 * RETURNING` - rather than a read then a write. Two taps arriving together would
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
      return { token, expires, userId: child.id };
    });
  } catch (error) {
    console.error('Failed to redeem login code', error);
    return null;
  }
}
