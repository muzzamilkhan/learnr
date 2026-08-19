import 'server-only';
import { prisma } from './db';
import { isRecord } from './speedrun/records';
import { modeKey, type Mode } from './speedrun/modes';

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

/**
 * Bank a finished run. No lock and no transaction beyond the upsert: a best is a
 * maximum, and a maximum is idempotent, so a retry or two tabs finishing at once
 * reach the same row in either order.
 *
 * Returns the outcome rather than swallowing failure, because the result screen
 * has to know what to show - and on null it shows the score with no comparison
 * beside it rather than claiming a best that was never written.
 */
export async function submitSpeedRun(
  userId: string,
  mode: Mode,
  run: { correct: number; answered: number },
): Promise<SpeedOutcome | null> {
  if (!prisma) return null;

  const key = modeKey(mode);
  try {
    const previous = await prisma.speedRecord.findUnique({
      where: { userId_mode: { userId, mode: key } },
    });
    const previousBest = previous?.best ?? null;
    const beat = isRecord(previousBest, run.correct);

    if (previous === null) {
      await prisma.speedRecord.create({
        data: { userId, mode: key, best: run.correct, answered: run.answered, seen: true },
      });
    } else if (beat) {
      // Guarded on `best` as well as the id, so a slower run that raced this one
      // cannot walk a record backwards.
      await prisma.speedRecord.updateMany({
        where: { userId, mode: key, best: { lt: run.correct } },
        data: { best: run.correct, answered: run.answered, achievedAt: new Date(), seen: false },
      });
    }

    return { previousBest, best: Math.max(previousBest ?? 0, run.correct), isRecord: beat };
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
