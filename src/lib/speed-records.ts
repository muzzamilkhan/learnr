import 'server-only';
import { prisma } from './db';
import { isRecord } from './speedrun/records';
import { modeKey, type Mode } from './speedrun/modes';
import { parseAvatar } from './avatars';
import { parsePhoto } from './photo/photo';
import { readAccount } from './accounts';
import { extendHouseholdWithShares, householdId } from './children';
import { standingChange, type FamilyRecord, type StandingChange } from './speedrun/leaderboard';
import { HISTORY_RUNS, type SpeedAttempt } from './speedrun/history';
import type { SummaryRun } from './speedrun/summary';

/**
 * The Prisma side of speed runs, beside `records.ts` and `accounts.ts` rather
 * than inside `src/lib/speedrun/`, which stays pure.
 *
 * Null means "could not read", never "nothing there" - the distinction
 * `readObservations` and `readSittings` already draw. A failed read rendered as
 * an empty cabinet tells a child they have never played.
 */

export interface SpeedOutcome {
  previousBest: number | null;
  best: number;
  isRecord: boolean;
  /**
   * The move this run made on the family board, or null when it made none -
   * nobody else runs this mode, the place did not change, or the household
   * could not be read. `standingChange` decides which, and the result screen
   * says nothing at all when this is null.
   */
  standing: StandingChange | null;
}

export interface ChildRecord {
  childId: string;
  childName: string;
  mode: string;
  best: number;
  achievedAt: Date;
}

/**
 * One player's best runs at each mode - up to `HISTORY_RUNS` of them, ranked in
 * the database rather than in the app.
 *
 * The slicing is a `ROW_NUMBER()` window, the same shape `readAnsweredQuestions`
 * uses and for the same reason: taking the last few hundred runs and hoping
 * would quietly show nothing for a mode last played a while ago, which is
 * exactly the mode somebody came to look at. `runHistory` still re-ranks what
 * comes back - the ordering is cheap, it is tested there, and the read is not
 * where a tie-breaking rule should live.
 *
 * Null means the read failed, never that nothing has been played - the
 * distinction `readObservations` draws.
 */
export async function readSpeedAttempts(userId: string): Promise<SpeedAttempt[] | null> {
  if (!prisma) return [];
  try {
    return await prisma.$queryRaw<SpeedAttempt[]>`
      SELECT "mode", "correct", "playedAt"
      FROM (
        SELECT "mode", "correct", "playedAt",
               ROW_NUMBER() OVER (
                 PARTITION BY "mode"
                 -- The earlier run set a tied score, so it is the one kept and
                 -- the one starred; the id settles the rest so two reads cannot
                 -- return different rows.
                 ORDER BY "correct" DESC, "playedAt" ASC, "id" ASC
               ) AS place
        FROM "SpeedAttempt"
        WHERE "userId" = ${userId}
      ) ranked
      WHERE "place" <= ${HISTORY_RUNS}
    `;
  } catch (error) {
    console.error('Failed to read speed attempts', error);
    return null;
  }
}

/** The latest run and the one before it - all a change needs to be measured. */
const SUMMARY_RUNS = 2;

/**
 * One player's runs at each mode, cut to what the report's table needs: the
 * latest two, plus the best if it is neither of them.
 *
 * The table shows a best, a latest run and the change between the latest and
 * the one before it, so three rows a mode is all it can ever read - and taking
 * the last few hundred runs and hoping is the shape `readAnsweredQuestions`
 * already rejects, for the same reason. Two `ROW_NUMBER()` windows over the
 * same rows do the cutting in the database: one ranks by score so the best
 * survives however old it is, one ranks by recency so the latest pair always
 * does. `speedSummaries` takes the maximum over what comes back, which is why
 * the best has to be in it.
 *
 * Null means the read failed, never that nothing has been played - the
 * distinction `readObservations` draws.
 */
export async function readSpeedSummaries(userId: string): Promise<SummaryRun[] | null> {
  if (!prisma) return [];
  try {
    return await prisma.$queryRaw<SummaryRun[]>`
      SELECT "mode", "correct", "playedAt"
      FROM (
        SELECT "mode", "correct", "playedAt",
               ROW_NUMBER() OVER (
                 PARTITION BY "mode"
                 -- The earlier run set a tied best, exactly as the cabinet reads it.
                 ORDER BY "correct" DESC, "playedAt" ASC, "id" ASC
               ) AS best_place,
               ROW_NUMBER() OVER (
                 PARTITION BY "mode"
                 ORDER BY "playedAt" DESC, "id" DESC
               ) AS recent_place
        FROM "SpeedAttempt"
        WHERE "userId" = ${userId}
      ) ranked
      WHERE "best_place" = 1 OR "recent_place" <= ${SUMMARY_RUNS}
    `;
  } catch (error) {
    console.error('Failed to read speed summaries', error);
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
  correct: number,
): Promise<SpeedOutcome | null> {
  if (!prisma) return null;

  // Two independent writes, so they go together rather than one after the
  // other: the record is the maximum and the attempt is the history behind it,
  // and neither reads what the other does. A failed attempt row costs a line in
  // the cabinet's table; a failed record costs the outcome this returns, which
  // is why only one of the two can decide what the result screen says.
  const [, banked] = await Promise.all([
    recordAttempt(userId, modeKey(mode), correct),
    bankRecord(userId, modeKey(mode), correct),
  ]);
  if (banked === null) return null;

  // After the write, never beside it: the place this run earned is a place
  // among what is *stored*, and reading the board before the row landed would
  // rank the player on the score they arrived with.
  return { ...banked, standing: await readStanding(userId, modeKey(mode), banked) };
}

/** What banking a run settles on its own - the board is asked afterwards. */
type BankedRecord = Omit<SpeedOutcome, 'standing'>;

/**
 * Where this run left the player on their family's board, if it moved them.
 *
 * Best-effort and quiet, like everything else on this path: the run is over and
 * the score is already on screen, so a household that cannot be read costs the
 * one extra line rather than the result. Null is the ordinary answer - most
 * runs move nobody, and `standingChange` is where that judgement lives.
 *
 * Only the *rivals* are read, and the player's own row is left out on purpose:
 * their own two scores are already in hand as `previousBest` and `best`, and
 * re-reading the row the write just touched would be asking the database to
 * confirm what the write already returned.
 */
async function readStanding(
  userId: string,
  key: string,
  banked: BankedRecord,
): Promise<StandingChange | null> {
  if (!prisma) return null;
  try {
    const account = await readAccount(userId);
    // A child on their own Google account, or a parent with nobody, has no
    // household - which is the same "there is no board here" the leaderboard
    // page answers with a sentence.
    const household = account ? householdId(account) : null;
    if (household === null) return null;

    const rivals = await prisma.speedRecord.findMany({
      where: { mode: key, userId: { in: await householdMemberIds(household), not: userId } },
      select: { best: true },
    });

    return standingChange(
      rivals.map((rival) => rival.best),
      banked.previousBest,
      banked.best,
    );
  } catch (error) {
    console.error('Failed to read family standing', error);
    return null;
  }
}

/**
 * Keep the run itself, beaten or not - the table of five in the cabinet is
 * built from these, and a run that failed to beat the best is exactly the kind
 * that says whether a best was a fluke.
 *
 * Best-effort like `records.ts`: the run is over, and a lost row costs a line
 * of history rather than a game. It needs no guard of any kind - an insert is
 * neither a maximum nor a counter, so a retry writes a second row rather than
 * paying twice, which is the honest reading of two runs anyway.
 */
async function recordAttempt(userId: string, mode: string, correct: number): Promise<void> {
  if (!prisma) return;
  try {
    await prisma.speedAttempt.create({ data: { userId, mode, correct } });
  } catch (error) {
    console.error('Failed to record speed attempt', error);
  }
}

async function bankRecord(
  userId: string,
  key: string,
  correct: number,
): Promise<BankedRecord | null> {
  if (!prisma) return null;
  const db = prisma;

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
    const beatsPreviousBest = isRecord(previousBest, correct);

    // The WHERE clause is `isRecord`'s rule written in SQL: a row only updates
    // if this score is strictly above what is stored, so a match here is proof
    // the write landed, not an inference from a read taken before it.
    const guardedUpdate = () =>
      db.speedRecord.updateMany({
        where: { userId, mode: key, best: { lt: correct } },
        data: { best: correct, achievedAt: new Date(), seen: !beatsPreviousBest },
      });

    let updated = await guardedUpdate();

    if (updated.count === 0 && initial === null) {
      try {
        await db.speedRecord.create({
          data: { userId, mode: key, best: correct, seen: true },
        });
        // A first-ever run is never a record - see `isRecord`.
        return { previousBest: null, best: correct, isRecord: false };
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
      return { previousBest, best: correct, isRecord: beatsPreviousBest };
    }

    // Nothing landed: either this score was never beatable, or a concurrent run
    // beat us to the same row first. Read back what is actually stored rather
    // than trusting the snapshot taken before any of this happened.
    const current = await db.speedRecord.findUnique({ where: { userId_mode: { userId, mode: key } } });
    return { previousBest, best: current?.best ?? correct, isRecord: false };
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
 * Every speed record on one family's board - the household's own runs, widened
 * by every accepted share touching it.
 *
 * `parentId` is the household's head, exactly what `householdId` already
 * resolves to for anyone with one - a parent themselves, or a managed child's
 * parent. That is enough to find the household outright, but a share crosses a
 * household's border on purpose (see **Sharing a child** in `CLAUDE.md`), so a
 * second read finds every grant touching it either way: one where this
 * household is the owner sharing a child out, one where it is the viewer a
 * child was shared in to. `extendHouseholdWithShares` turns those into the
 * final id list - the viewer and the specific child a grant names, never the
 * rest of either side, the same privacy the report itself already gives a
 * share.
 *
 * The household and the shares are independent of one another and read
 * together, but both have to be in before the id list they build is known, so
 * the record read itself is still a second round trip rather than one query
 * the three could all be folded into.
 *
 * Null means the read failed, as everywhere here - a board drawn empty would
 * say a family has never played, which is the lie `readObservations` draws the
 * same distinction to prevent.
 */
/**
 * Who is on one family's board: the household, widened by every share touching
 * it.
 *
 * Lifted out of `readFamilyRecords` when the result screen needed the same
 * family for one mode - two copies of "who counts as this family" is exactly
 * the second truth `ChildShare` carrying no `ownerId` exists to avoid.
 */
async function householdMemberIds(parentId: string): Promise<string[]> {
  if (!prisma) return [];
  // Independent of one another, so read together rather than one after the
  // other - the same reason `readPlayerState` folds its reads into one trip.
  const [household, shares] = await Promise.all([
    prisma.user.findMany({
      where: { OR: [{ id: parentId }, { parentId }] },
      select: { id: true },
    }),
    prisma.childShare.findMany({
      where: { OR: [{ child: { parentId } }, { viewerId: parentId }] },
      select: { childId: true, viewerId: true, child: { select: { parentId: true } } },
    }),
  ]);

  return extendHouseholdWithShares(
    household.map((user) => user.id),
    shares.map((share) => ({
      childId: share.childId,
      viewerId: share.viewerId,
      ownerId: share.child.parentId ?? parentId,
    })),
  );
}

export async function readFamilyRecords(parentId: string): Promise<FamilyRecord[] | null> {
  if (!prisma) return [];
  try {
    const memberIds = await householdMemberIds(parentId);

    const rows = await prisma.speedRecord.findMany({
      where: { userId: { in: memberIds } },
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
