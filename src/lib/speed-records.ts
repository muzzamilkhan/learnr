import 'server-only';
import { prisma } from './db';
import { isRecord } from './speedrun/records';
import { modeKey, type Mode } from './speedrun/modes';
import { parseAvatar } from './avatars';
import { parsePhoto } from './photo/photo';
import type { FamilyRecord } from './speedrun/leaderboard';

/**
 * The Prisma side of speed runs, beside `records.ts` and `accounts.ts` rather
 * than inside `src/lib/speedrun/`, which stays pure.
 *
 * Null means "could not read", never "nothing there" - the distinction
 * `readObservations` and `readSittings` already draw. A failed read rendered as
 * an empty cabinet tells a child they have never played.
 */

export interface SpeedBest {
  mode: string;
  best: number;
  answered: number;
  achievedAt: Date;
}

export interface SpeedOutcome {
  previousBest: number | null;
  best: number;
  isRecord: boolean;
}

export interface ChildRecord {
  childId: string;
  childName: string;
  mode: string;
  best: number;
  achievedAt: Date;
}

/** Every mode this player has run. Null means the read failed. */
export async function readSpeedRecords(userId: string): Promise<SpeedBest[] | null> {
  if (!prisma) return [];
  try {
    const rows = await prisma.speedRecord.findMany({
      where: { userId },
      select: { mode: true, best: true, answered: true, achievedAt: true },
    });
    return rows;
  } catch (error) {
    console.error('Failed to read speed records', error);
    return null;
  }
}

/** Postgres' unique violation, as Prisma reports it - someone else's row landed first. */
const isUniqueViolation = (error: unknown): boolean =>
  typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002';

/**
 * Bank a finished run.
 *
 * No lock, and no upsert either: a best is a maximum, and a maximum is
 * idempotent, so a guarded update needs nothing more than its own WHERE clause
 * to be safe under two runs landing at once. What still needs guarding is the
 * *insert* - the row cannot be locked before it exists, so two concurrent
 * first-ever runs on the same mode can both read no row and both try to create
 * one. `updateTopicSkill` (`src/lib/records.ts`) hits the identical race on
 * `TopicSkill` and retries past it; this does the same, once - one time round
 * is enough.
 *
 * The returned outcome is derived from what the writes actually did, never from
 * the read taken before them: a guarded update that matches no rows is a no-op,
 * and reporting a record for a write that never landed would show a child a
 * "new best" screen for a score that was never stored.
 */
export async function submitSpeedRun(
  userId: string,
  mode: Mode,
  run: { correct: number; answered: number },
): Promise<SpeedOutcome | null> {
  if (!prisma) return null;
  const db = prisma;
  const key = modeKey(mode);

  try {
    const initial = await db.speedRecord.findUnique({ where: { userId_mode: { userId, mode: key } } });
    const previousBest = initial?.best ?? null;

    // Fixed once, before either write attempt, and reused by both: whether
    // this run beats a previous best of *this player's own* - never whether a
    // write happens to land. `seen` and the returned `isRecord` are both built
    // from this single value below, so they can never disagree about the same
    // event: `seen: false` (the parent's banner fires) if and only if
    // `isRecord: true` (the child's celebration fires). A landed write with no
    // previous best to beat - two first-ever runs racing each other - is a
    // first run twice over, not a comeback, so it announces nothing either way.
    const beatsPreviousBest = isRecord(previousBest, run.correct);

    // The WHERE clause is `isRecord`'s rule written in SQL: a row only updates
    // if this score is strictly above what is stored, so a match here is proof
    // the write landed, not an inference from a read taken before it.
    const guardedUpdate = () =>
      db.speedRecord.updateMany({
        where: { userId, mode: key, best: { lt: run.correct } },
        data: {
          best: run.correct,
          answered: run.answered,
          achievedAt: new Date(),
          seen: !beatsPreviousBest,
        },
      });

    let updated = await guardedUpdate();

    if (updated.count === 0 && initial === null) {
      try {
        await db.speedRecord.create({
          data: { userId, mode: key, best: run.correct, answered: run.answered, seen: true },
        });
        // A first-ever run is never a record - see `isRecord`.
        return { previousBest: null, best: run.correct, isRecord: false };
      } catch (error) {
        if (!isUniqueViolation(error)) throw error;
        // Someone else's first run landed between our read and our insert -
        // there is a row now, so try the guarded update once more rather than
        // looping on `create` again. `previousBest` is still null on this
        // path, so `beatsPreviousBest` is still false and the retried write
        // still sets `seen: true` - it is exactly as unannounced as the
        // `create` above would have been.
        updated = await guardedUpdate();
      }
    }

    if (updated.count > 0) {
      return { previousBest, best: run.correct, isRecord: beatsPreviousBest };
    }

    // Nothing landed: either this score was never beatable, or a concurrent run
    // beat us to the same row first. Read back what is actually stored rather
    // than trusting the snapshot taken before any of this happened.
    const current = await db.speedRecord.findUnique({ where: { userId_mode: { userId, mode: key } } });
    return { previousBest, best: current?.best ?? run.correct, isRecord: false };
  } catch (error) {
    console.error('Failed to submit speed run', error);
    return null;
  }
}

/** This parent's children's unseen records, newest first. Null means the read failed. */
export async function readUnseenRecords(parentId: string): Promise<ChildRecord[] | null> {
  if (!prisma) return [];
  try {
    const rows = await prisma.speedRecord.findMany({
      where: { seen: false, user: { parentId } },
      orderBy: { achievedAt: 'desc' },
      select: { userId: true, mode: true, best: true, achievedAt: true, user: { select: { name: true } } },
    });
    return rows.map((row) => ({
      childId: row.userId,
      childName: row.user.name ?? '',
      mode: row.mode,
      best: row.best,
      achievedAt: row.achievedAt,
    }));
  } catch (error) {
    console.error('Failed to read unseen speed records', error);
    return null;
  }
}

/** Dismiss the banner: marks every unseen record for one child seen. */
export async function dismissSpeedRecords(parentId: string, childId: string): Promise<boolean> {
  if (!prisma) return false;
  try {
    await prisma.speedRecord.updateMany({
      where: { userId: childId, seen: false, user: { parentId } },
      data: { seen: true },
    });
    return true;
  } catch (error) {
    console.error('Failed to dismiss speed records', error);
    return false;
  }
}

/**
 * Every speed record in one household - the parent's own runs and their
 * children's, since both bank to the same table and a parent plays too.
 *
 * One query rather than a read per member: the leaderboard needs all of it
 * before it can rank any of it, and asking a member at a time would be the
 * waterfall `readPlayerState` exists to avoid.
 *
 * Null means the read failed, as everywhere here - a board drawn empty would
 * say a family has never played, which is the lie `readObservations` draws the
 * same distinction to prevent.
 */
export async function readFamilyRecords(parentId: string): Promise<FamilyRecord[] | null> {
  if (!prisma) return [];
  try {
    const rows = await prisma.speedRecord.findMany({
      // The household, read from both ends of `parentId` - the parent
      // themselves, and everyone they manage.
      where: { user: { OR: [{ id: parentId }, { parentId }] } },
      select: {
        userId: true,
        mode: true,
        best: true,
        achievedAt: true,
        // The board draws faces, so it reads what a face is made of: the
        // photograph a parent cropped, then the animal the player picked, then
        // the picture Google gave a grown-up - who has no avatar and never had a
        // photo cropped for them, so it is the only face they own.
        user: {
          select: {
            name: true,
            avatar: true,
            image: true,
            photo: { select: { dataUrl: true } },
          },
        },
      },
    });
    return rows.map((row) => ({
      playerId: row.userId,
      playerName: row.user.name ?? '',
      playerPhoto: parsePhoto(row.user.photo?.dataUrl),
      playerAvatar: parseAvatar(row.user.avatar),
      playerImage: row.user.image,
      mode: row.mode,
      best: row.best,
      achievedAt: row.achievedAt,
    }));
  } catch (error) {
    console.error('Failed to read family speed records', error);
    return null;
  }
}
