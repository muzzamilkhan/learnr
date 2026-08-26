import { randomInt } from 'node:crypto';
import { prisma } from '../db.js';
import { parseAvatar, type Avatar } from '@learnr/core/avatars';
import { listChildren, type ChildProfile } from './accounts.js';
import { mergeViewable, groupViewers, type ChildAccess, type SharedViewer } from '@learnr/core/children';
import { generateShareToken, inviteExpiry, normaliseToken } from '@learnr/core/share-link';
import { parseTarget } from '@learnr/core/rewards/target';
import { parsePhoto } from '@learnr/core/photo/photo';

/**
 * Sharing a child with a second grown-up: a separated parent, a grandparent, a
 * tutor. One link, one person, and what they get is the report and nothing else.
 *
 * The Prisma side, following `accounts.ts`: every query is scoped by the id of
 * whoever is asking, reads say `null` for *could not read* rather than throwing
 * into a page render, and the mutations report whether they worked - a share that
 * silently fails to revoke is a parent lied to about who can see their child.
 *
 * **Read-only is a property of the schema here, not a check in this file.** A
 * grant is a `ChildShare` row, and nothing in `accounts.ts` matches on anything
 * but `parentId`, so there is no query in the app that edits a child and can be
 * reached through a grant. That is why `updateChild`, `removeChild` and
 * `issueLoginCode` needed no changes to stay safe from a viewer, and why the way
 * to keep them safe is to leave them scoped by ownership rather than to add a
 * permission flag anyone could forget to consult.
 */

/** A child someone may look at, and on what footing. */
export interface ViewableChild extends ChildProfile {
  access: ChildAccess;
  /** The name of the parent who shared them, on a shared child only. */
  sharedBy: string | null;
}

/**
 * Every child this person may look at: their own, then the ones shared with them.
 *
 * `null` means *could not read*, the same distinction `listChildren` makes and for
 * the same reason - an empty dashboard and a failed read must not render alike.
 * It is the list every parent screen resolves `?child=` against, so a child not in
 * it is not reachable by typing its id: there is no separate ownership check here
 * to drift out of step with the query that produced the list.
 */
export async function readViewableChildren(userId: string): Promise<ViewableChild[] | null> {
  if (!prisma) return [];

  const owned = await listChildren(userId);
  if (owned === null) return null;

  const shared = await listSharedWithMe(userId);
  if (shared === null) return null;

  return mergeViewable<Omit<ViewableChild, 'access'>>(
    owned.map((child) => ({ ...child, sharedBy: null })),
    shared,
  );
}

/**
 * The children other parents have shared with this one.
 *
 * A viewer never sees a login code, so the code columns are not selected at all
 * rather than selected and blanked - the safest way to not leak a field is to
 * never fetch it. The target comes along because the report draws the practice
 * calendar against it, and that is a fact about the child rather than something
 * only their owner may know.
 */
async function listSharedWithMe(
  viewerId: string,
): Promise<Omit<ViewableChild, 'access'>[] | null> {
  if (!prisma) return [];
  try {
    const rows = await prisma.childShare.findMany({
      where: { viewerId },
      orderBy: { createdAt: 'asc' },
      select: {
        child: {
          select: {
            id: true,
            name: true,
            avatar: true,
            photo: { select: { dataUrl: true } },
            selectedLevel: true,
            targetKind: true,
            targetValue: true,
            parent: { select: { name: true, email: true } },
          },
        },
      },
    });

    return rows.map(({ child }) => ({
      id: child.id,
      name: child.name ?? '',
      avatar: parseAvatar(child.avatar) ?? 'fox',
      // A viewer sees the face the owner set, for the reason they see the name:
      // it is how a grown-up reading two families' children tells them apart.
      photo: parsePhoto(child.photo?.dataUrl),
      level: child.selectedLevel,
      target: parseTarget(child.targetKind, child.targetValue),
      // Never shown to a viewer, and never read either.
      code: null,
      codeExpiresAt: null,
      sharedBy: child.parent?.name ?? child.parent?.email ?? null,
    }));
  } catch (error) {
    console.error('Failed to list shared children', error);
    return null;
  }
}

/** A link that has been created and not yet opened. */
export interface PendingInvite {
  id: string;
  token: string;
  childIds: string[];
  createdAt: Date;
  expiresAt: Date;
}

/**
 * The links this parent has sent that nobody has accepted yet, newest first. An
 * expired one is dropped rather than listed as dead: the panel is a list of what
 * is outstanding, and a link nobody can use is not outstanding.
 */
export async function listPendingInvites(
  ownerId: string,
  now = new Date(),
): Promise<PendingInvite[] | null> {
  if (!prisma) return [];
  try {
    return await prisma.shareInvite.findMany({
      where: { ownerId, acceptedAt: null, expiresAt: { gt: now } },
      orderBy: { createdAt: 'desc' },
      select: { id: true, token: true, childIds: true, createdAt: true, expiresAt: true },
    });
  } catch (error) {
    console.error('Failed to list share invites', error);
    return null;
  }
}

/** Everyone this parent has shared with, and which children each can see. */
export async function listSharedViewers(ownerId: string): Promise<SharedViewer[] | null> {
  if (!prisma) return [];
  try {
    const rows = await prisma.childShare.findMany({
      // Through the child, because the child is where ownership lives. There is
      // no `ownerId` on a grant to disagree with `parentId`.
      where: { child: { parentId: ownerId } },
      orderBy: [{ viewerId: 'asc' }, { createdAt: 'asc' }],
      select: {
        childId: true,
        child: { select: { name: true } },
        viewer: { select: { id: true, name: true, email: true, image: true } },
      },
    });

    return groupViewers(
      rows.map((row) => ({
        childId: row.childId,
        childName: row.child.name ?? '',
        viewerId: row.viewer.id,
        viewerName: row.viewer.name,
        viewerEmail: row.viewer.email,
        viewerImage: row.viewer.image,
      })),
    );
  } catch (error) {
    console.error('Failed to list shared viewers', error);
    return null;
  }
}

/**
 * Make a link covering these children.
 *
 * Every id is checked against this parent's own children and the whole thing is
 * refused if one of them isn't - narrowing to the ids that happened to pass would
 * hand back a link quietly covering less than the parent chose, and they would
 * find out from the other end of it.
 *
 * There is no retry loop around the token the way there is around a login code. A
 * four-character code collides often enough to plan for; 32 characters of a
 * 62-character alphabet does not, so a unique violation here is a fault to report
 * rather than a case to handle.
 */
export async function createShareInvite(
  ownerId: string,
  childIds: string[],
  now = new Date(),
): Promise<{ token: string; expiresAt: Date } | null> {
  if (!prisma) return null;

  const wanted = [...new Set(childIds)];
  if (wanted.length === 0) return null;

  try {
    const owned = await prisma.user.findMany({
      where: { parentId: ownerId, id: { in: wanted } },
      select: { id: true },
    });
    if (owned.length !== wanted.length) return null;

    const token = generateShareToken((max) => randomInt(max));
    const expiresAt = inviteExpiry(now);
    await prisma.shareInvite.create({ data: { token, ownerId, childIds: wanted, expiresAt } });
    return { token, expiresAt };
  } catch (error) {
    console.error('Failed to create share invite', error);
    return null;
  }
}

/** A link, as the page behind it describes itself to whoever opened it. */
export interface InviteDetails {
  /** Who is offering, for a page whose whole job is to say "accept this?". */
  ownerId: string;
  ownerName: string | null;
  children: {
    id: string;
    name: string;
    avatar: Avatar;
    photo: string | null;
    level: string | null;
  }[];
  expiresAt: Date;
  /** False once it has been accepted or has run out of its week. */
  live: boolean;
}

/**
 * What a link offers, for the page that shows it before anyone signs in.
 *
 * The children are re-read from the parent's current children rather than trusted
 * from the invite's array, so a child removed since the link was made is simply
 * not in it - the same filter acceptance applies, run twice so the page cannot
 * promise something the acceptance would then not grant.
 */
export async function readShareInvite(
  token: string,
  now = new Date(),
): Promise<InviteDetails | null> {
  if (!prisma) return null;

  const clean = normaliseToken(token);
  if (!clean) return null;

  try {
    const invite = await prisma.shareInvite.findUnique({
      where: { token: clean },
      select: {
        ownerId: true,
        childIds: true,
        expiresAt: true,
        acceptedAt: true,
        owner: { select: { name: true, email: true } },
      },
    });
    if (!invite) return null;

    const children = await prisma.user.findMany({
      where: { parentId: invite.ownerId, id: { in: invite.childIds } },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        name: true,
        avatar: true,
        photo: { select: { dataUrl: true } },
        selectedLevel: true,
      },
    });

    return {
      ownerId: invite.ownerId,
      ownerName: invite.owner.name ?? invite.owner.email ?? null,
      children: children.map((child) => ({
        id: child.id,
        name: child.name ?? '',
        avatar: parseAvatar(child.avatar) ?? 'fox',
        photo: parsePhoto(child.photo?.dataUrl),
        level: child.selectedLevel,
      })),
      expiresAt: invite.expiresAt,
      live: invite.acceptedAt === null && now < invite.expiresAt,
    };
  } catch (error) {
    console.error('Failed to read share invite', error);
    return null;
  }
}

/**
 * What became of an acceptance. A reason rather than a bare false, because the
 * person reading it has just followed a link and needs to know whether to ask for
 * another one.
 */
export type AcceptResult =
  | { ok: true; children: number }
  | { ok: false; reason: 'unavailable' | 'own-link' | 'error' };

/**
 * Take a link: spend it, and leave the grants behind.
 *
 * Spending it is one statement - `UPDATE ... RETURNING` on the token *and* a null
 * `acceptedAt` - for the reason `redeemLoginCode` is written the same way: two
 * taps arriving together would both pass a read-then-write, and only one can win a
 * conditional update.
 *
 * A parent opening their own link is caught before the update rather than after,
 * so following your own link to check it does not burn it.
 *
 * The grants are `createMany ... skipDuplicates`: a second link covering a child
 * this person already sees is not an error, it is a link that grants nothing new.
 */
export async function acceptShareInvite(
  token: string,
  viewerId: string,
  now = new Date(),
): Promise<AcceptResult> {
  if (!prisma) return { ok: false, reason: 'error' };

  const clean = normaliseToken(token);
  if (!clean) return { ok: false, reason: 'unavailable' };

  const db = prisma;
  try {
    const existing = await db.shareInvite.findUnique({
      where: { token: clean },
      select: { ownerId: true, childIds: true, acceptedById: true },
    });
    if (!existing) return { ok: false, reason: 'unavailable' };
    if (existing.ownerId === viewerId) return { ok: false, reason: 'own-link' };

    // Already theirs. Accepting is what the tap after signing in does, and a
    // reload or a double-fire of that must read as "you have this" rather than
    // as a dead link - the grants are there either way, and telling someone
    // their link failed while they hold what it gave them is the worse lie.
    if (existing.acceptedById === viewerId) {
      const held = await db.childShare.count({
        where: { viewerId, childId: { in: existing.childIds } },
      });
      return { ok: true, children: held };
    }

    return await db.$transaction(async (tx) => {
      const claimed = await tx.$queryRaw<{ ownerId: string; childIds: string[] }[]>`
        UPDATE "ShareInvite"
        SET "acceptedAt" = ${now}, "acceptedById" = ${viewerId}
        WHERE "token" = ${clean} AND "acceptedAt" IS NULL AND "expiresAt" > ${now}
        RETURNING "ownerId", "childIds"
      `;

      const invite = claimed[0];
      if (!invite) {
        // The UPDATE matched nothing, but that is also what a second, concurrent
        // acceptance by this same viewer looks like: the pre-transaction read
        // above can't see a call that is still in flight, only one that has
        // already committed. By the time our UPDATE has blocked on the row lock
        // and lost, the other transaction has committed, so a fresh read here
        // sees it. Telling this viewer their own just-granted link "didn't work"
        // is the exact lie `acceptedById === viewerId` above exists to avoid -
        // this is that same check, for the race that check can't see.
        const now = await tx.shareInvite.findUnique({
          where: { token: clean },
          select: { acceptedById: true, childIds: true },
        });
        if (now?.acceptedById === viewerId) {
          const held = await tx.childShare.count({
            where: { viewerId, childId: { in: now.childIds } },
          });
          return { ok: true, children: held } as const;
        }
        return { ok: false, reason: 'unavailable' } as const;
      }

      // The invite's array is a record of what was offered, so what it can still
      // grant is whatever of it the issuer owns *now*. A child removed since is
      // simply not granted.
      const children = await tx.user.findMany({
        where: { parentId: invite.ownerId, id: { in: invite.childIds } },
        select: { id: true },
      });

      await tx.childShare.createMany({
        data: children.map((child) => ({ childId: child.id, viewerId })),
        skipDuplicates: true,
      });

      // A grown-up arriving through a link is a parent, the same answer a
      // Google sign-in gets everywhere else. A compare-and-set on `role IS
      // NULL`, like `claimParentRole`, written out here rather than called
      // because it has to run inside this transaction - so an existing child
      // account is never quietly promoted.
      await tx.user.updateMany({ where: { id: viewerId, role: null }, data: { role: 'parent' } });

      return { ok: true, children: children.length } as const;
    });
  } catch (error) {
    console.error('Failed to accept share invite', error);
    return { ok: false, reason: 'error' };
  }
}

/** Withdraw a link nobody has taken up yet. An accepted one is revoked, not cancelled. */
export async function cancelShareInvite(ownerId: string, inviteId: string): Promise<boolean> {
  if (!prisma) return false;
  try {
    const removed = await prisma.shareInvite.deleteMany({
      where: { id: inviteId, ownerId, acceptedAt: null },
    });
    return removed.count > 0;
  } catch (error) {
    console.error('Failed to cancel share invite', error);
    return false;
  }
}

/**
 * Take back what a viewer can see: one child of theirs, or all of them.
 *
 * Scoped through the child rather than by an owner column on the grant, so the
 * check is ownership itself. `childId` omitted means the whole person, which is
 * what "remove their access" on the panel does.
 */
export async function revokeShare(
  ownerId: string,
  viewerId: string,
  childId?: string,
): Promise<boolean> {
  if (!prisma) return false;
  try {
    const removed = await prisma.childShare.deleteMany({
      where: { viewerId, child: { parentId: ownerId }, ...(childId ? { childId } : {}) },
    });
    return removed.count > 0;
  } catch (error) {
    console.error('Failed to revoke share', error);
    return false;
  }
}

/**
 * A viewer giving up their own access. Their grant is theirs to drop, so this is
 * scoped by `viewerId` alone - it can only ever reach a row that is about them.
 */
export async function leaveShare(viewerId: string, childId: string): Promise<boolean> {
  if (!prisma) return false;
  try {
    const removed = await prisma.childShare.deleteMany({ where: { viewerId, childId } });
    return removed.count > 0;
  } catch (error) {
    console.error('Failed to leave share', error);
    return false;
  }
}
