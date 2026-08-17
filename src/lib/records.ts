import 'server-only';
import {
  emptyProfile,
  nextSkill,
  type LearnerProfile,
  type Observation,
  type TopicSkill,
} from './analytics/profile';
import { parseYearLevel, type YearLevel } from './curriculum';
import { prisma } from './db';
import { nextPlayStreak, startedNewDay, noStreak, type PlayStreak } from './rewards/streak';
import { starsEarned } from './rewards/stars';
import type { Attempt } from './session/session';

/**
 * Recording is fire-and-forget and best effort: a child answering questions must
 * never be blocked or interrupted by a database problem. An attempt that fails to
 * write costs history, never the question in front of the child.
 *
 * Two things are written per answer: the attempt itself, and the running skill
 * for its topic. The skill row is what the next session reads to weight its
 * questions, folded forward with the same `nextSkill` the in-memory profile uses,
 * so the stored profile and the played one cannot drift apart.
 */

/** The year the child last chose, as stored — the caller resolves it against content. */
export async function readSelectedLevel(userId: string): Promise<string | null> {
  if (!prisma) return null;
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { selectedLevel: true },
    });
    return user?.selectedLevel ?? null;
  } catch (error) {
    console.error('Failed to read selected level', error);
    return null;
  }
}

export async function writeSelectedLevel(userId: string, level: YearLevel): Promise<void> {
  if (!prisma) return;
  try {
    await prisma.user.update({ where: { id: userId }, data: { selectedLevel: level } });
  } catch (error) {
    console.error('Failed to write selected level', error);
  }
}

export interface StartRecordInput {
  userId: string;
  subject: string;
  level: YearLevel;
  seed: string;
}

export async function recordSessionStart(input: StartRecordInput): Promise<string | null> {
  if (!prisma) return null;
  try {
    const session = await prisma.learningSession.create({ data: input });
    return session.id;
  } catch (error) {
    console.error('Failed to record session start', error);
    return null;
  }
}

/** The session id round-trips through the client, so never trust it without this. */
async function ownsSession(userId: string, learningSessionId: string): Promise<boolean> {
  if (!prisma) return false;
  const found = await prisma.learningSession.findFirst({
    where: { id: learningSessionId, userId },
    select: { id: true },
  });
  return found !== null;
}

/** Postgres' unique violation, as Prisma reports it — someone else created the row first. */
const isUniqueViolation = (error: unknown): boolean =>
  typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002';

/** The row as the lock reads it back. Only `nextSkill` interprets these. */
type StoredSkill = Parameters<typeof toSkill>[0] & { id: string };

/**
 * Only the very first answer on a topic can lose its race — after that the row
 * exists and the lock does the queueing. One retry would do; a couple is slack.
 */
const WRITE_ATTEMPTS = 3;

/**
 * One answer folded into the child's running skill for that topic. Read, fold,
 * write: the arithmetic is `nextSkill`, the same step the session applies in
 * memory, so what is stored is what was played.
 *
 * The read takes a row lock, so answers arriving at once queue up and each folds
 * onto the one before. Without it two writes both read the same row and the
 * second silently overwrites the first — an answer lost, and this row no longer
 * the fold of the attempts it claims to be. Two tabs will do it, and so will one
 * child answering faster than the round trip.
 *
 * A lock is used rather than merging the numbers in SQL so that `nextSkill`
 * stays the only place the arithmetic is written down. `SELECT ... FOR UPDATE`
 * has nothing to hold when the row does not exist yet, so the first answer on a
 * topic can still collide on insert; that is what the retry is for, and one time
 * round is enough because the row exists by then.
 */
async function updateTopicSkill(userId: string, attempt: Attempt): Promise<void> {
  if (!prisma) return;

  const db = prisma;
  const identity = { userId, subject: attempt.subject, topic: attempt.topic, level: attempt.level };

  for (let tries = 0; tries < WRITE_ATTEMPTS; tries++) {
    try {
      await db.$transaction(async (tx) => {
        const rows = await tx.$queryRaw<StoredSkill[]>`
          SELECT "id", "topic", "level", "attempts", "correct", "strength", "streak",
                 "correctDays", "lastCorrectDay", "totalTimeMs", "lastAnsweredAt"
          FROM "TopicSkill"
          WHERE "userId" = ${userId}
            AND "subject" = ${attempt.subject}
            AND "topic" = ${attempt.topic}
            AND "level" = ${attempt.level}
          FOR UPDATE
        `;

        const row = rows[0];
        const skill = nextSkill(row ? toSkill(row) : undefined, attempt);

        const values = {
          attempts: skill.attempts,
          correct: skill.correct,
          strength: skill.strength,
          streak: skill.streak,
          correctDays: skill.correctDays,
          lastCorrectDay: skill.lastCorrectDay,
          totalTimeMs: skill.totalTimeMs,
          lastAnsweredAt: new Date(skill.lastAnsweredAt),
        };

        if (row) await tx.topicSkill.update({ where: { id: row.id }, data: values });
        else await tx.topicSkill.create({ data: { ...identity, ...values } });
      });
      return;
    } catch (error) {
      // Someone else created the row between the lock finding nothing and the
      // insert. Go round again; this time there is a row to hold.
      if (!isUniqueViolation(error)) throw error;
    }
  }

  throw new Error(`Gave up folding an answer into ${attempt.topic} after ${WRITE_ATTEMPTS} tries`);
}

/** What a recorded answer hands back to the play screen. Rewards only — never play. */
export interface AttemptResult {
  /** Days in a row including today. */
  streak: number;
  /** Whether this was the first answer of its day, and so worth showing. */
  streakAdvanced: boolean;
}

export async function recordAttempt(
  userId: string,
  learningSessionId: string,
  attempt: Attempt,
): Promise<AttemptResult | null> {
  if (!prisma) return null;
  try {
    if (!(await ownsSession(userId, learningSessionId))) return null;
    await prisma.attempt.create({
      data: {
        learningSessionId,
        templateId: attempt.templateId,
        subject: attempt.subject,
        topic: attempt.topic,
        level: attempt.level,
        prompt: attempt.prompt,
        expected: attempt.expected,
        response: attempt.response,
        correct: attempt.correct,
        timeTakenMs: attempt.timeTakenMs,
        answeredAt: new Date(attempt.answeredAt),
        offsetMinutes: attempt.offsetMinutes,
      },
    });
    await updateTopicSkill(userId, attempt);
    return await foldPlayStreak(userId, attempt);
  } catch (error) {
    console.error('Failed to record attempt', error);
    return null;
  }
}

/**
 * The streak moved on by one answer. Runs on every answer and writes on the
 * first of a day only, so the ordinary answer costs one indexed read.
 *
 * The write is a compare-and-set rather than a lock: it only lands if the day
 * stored is still the one that was read, so two answers arriving together can
 * advance the streak once between them. The loser reports the same number
 * without claiming the day — a streak counted twice would be worse than one
 * counted late.
 */
async function foldPlayStreak(userId: string, attempt: Attempt): Promise<AttemptResult | null> {
  if (!prisma) return null;

  const previous = await readPlayStreak(userId);
  const next = nextPlayStreak(previous, attempt.answeredAt, attempt.offsetMinutes);
  if (!startedNewDay(previous, next)) return { streak: next.days, streakAdvanced: false };

  const written = await prisma.user.updateMany({
    where: {
      id: userId,
      OR: [{ playStreakDay: null }, { playStreakDay: { lt: next.lastDay ?? 0 } }],
    },
    data: { playStreak: next.days, playStreakDay: next.lastDay },
  });

  return { streak: next.days, streakAdvanced: written.count > 0 };
}

/** The streak as stored. `currentStreak` decides whether it is still alive. */
export async function readPlayStreak(userId: string): Promise<PlayStreak> {
  if (!prisma) return noStreak();
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { playStreak: true, playStreakDay: true },
    });
    return user ? { days: user.playStreak, lastDay: user.playStreakDay } : noStreak();
  } catch (error) {
    console.error('Failed to read play streak', error);
    return noStreak();
  }
}

/**
 * Bank the stars for a sitting, recounted from that sitting's answers rather
 * than taken from the client. It is a *set*, not an increment, so calling it
 * twice for the same round is harmless — which matters, because the play screen
 * fires it best-effort and a retry is the cheapest way to survive a dropped one.
 *
 * Returns the session's running total, or null if nothing was written.
 */
export async function awardRoundStars(
  userId: string,
  learningSessionId: string,
): Promise<number | null> {
  if (!prisma) return null;
  try {
    if (!(await ownsSession(userId, learningSessionId))) return null;

    const answers = await prisma.attempt.findMany({
      where: { learningSessionId },
      // The same order the round chunking assumes: as they were answered, with the
      // id settling a tie so a recount cannot chunk differently to the last one.
      orderBy: [{ answeredAt: 'asc' }, { id: 'asc' }],
      select: { correct: true },
    });

    const stars = starsEarned(answers.map((answer) => answer.correct));
    await prisma.learningSession.updateMany({ where: { id: learningSessionId }, data: { stars } });
    return stars;
  } catch (error) {
    console.error('Failed to award stars', error);
    return null;
  }
}

/** Every star the child has, across every sitting. */
export async function readStarTotal(userId: string): Promise<number> {
  if (!prisma) return 0;
  try {
    const totals = await prisma.learningSession.aggregate({
      where: { userId },
      _sum: { stars: true },
    });
    return totals._sum.stars ?? 0;
  } catch (error) {
    console.error('Failed to read star total', error);
    return 0;
  }
}

/**
 * A stored skill row as the engines see it. A level that is no longer a school
 * year is dropped rather than guessed at — content is the source of truth, and a
 * row from a level that has gone is not worth steering questions with.
 */
function toSkill(row: {
  topic: string;
  level: string;
  attempts: number;
  correct: number;
  strength: number;
  streak: number;
  correctDays: number;
  lastCorrectDay: number | null;
  totalTimeMs: number;
  lastAnsweredAt: Date;
}): TopicSkill | undefined {
  const level = parseYearLevel(row.level);
  if (!level) return undefined;

  return {
    topic: row.topic,
    level,
    attempts: row.attempts,
    correct: row.correct,
    strength: row.strength,
    streak: row.streak,
    correctDays: row.correctDays,
    lastCorrectDay: row.lastCorrectDay,
    totalTimeMs: row.totalTimeMs,
    lastAnsweredAt: row.lastAnsweredAt.getTime(),
  };
}

/**
 * What the child has shown in this subject, for the session about to start. A
 * failure here is not fatal: an empty profile is exactly what a first-time child
 * has, and it means questions are drawn at random.
 */
export async function readLearnerProfile(userId: string, subject: string): Promise<LearnerProfile> {
  if (!prisma) return emptyProfile();
  try {
    const rows = await prisma.topicSkill.findMany({ where: { userId, subject } });
    return { skills: rows.map(toSkill).filter((skill) => skill !== undefined) };
  } catch (error) {
    console.error('Failed to read learner profile', error);
    return emptyProfile();
  }
}

/**
 * The topics the child last saw, newest first, so a session does not open on one
 * of them.
 *
 * Filtered on the *session's* subject and level rather than the attempt's. They
 * are the same thing — a sitting is one subject and one year, and its attempts
 * can be no other — but putting the whole predicate on one side lets the planner
 * narrow to a handful of that child's sessions first and walk their attempts in
 * order, instead of sifting every child's attempts for the subject.
 */
export async function readRecentTopics(
  userId: string,
  subject: string,
  level: YearLevel,
  count: number,
): Promise<string[]> {
  if (!prisma) return [];
  try {
    const rows = await prisma.attempt.findMany({
      where: { learningSession: { userId, subject, level } },
      orderBy: { answeredAt: 'desc' },
      take: count,
      select: { topic: true },
    });
    return rows.map((row) => row.topic);
  } catch (error) {
    console.error('Failed to read recent topics', error);
    return [];
  }
}

/** How much history the report reads. Two thousand answers is well over a year of practice. */
const HISTORY_LIMIT = 2000;

/**
 * The attempts behind the parents' report, oldest first. Read as raw history
 * rather than as skill rows because the report has to show change over time,
 * which a folded-up profile has already thrown away.
 *
 * Unlike the rest of this file it is **not** best-effort. Everything else here
 * serves a child mid-question, where a swallowed failure costs a little history
 * and the child plays on. Here an empty array renders as "your child has never
 * practised", which is a lie when the database merely hiccuped and is exactly
 * the failure `accounts.ts` refuses to make. So `null` means *could not read*
 * and `[]` means *nothing recorded*, and the screen says something different
 * for each.
 */
export async function readObservations(
  userId: string,
  subject: string,
  limit = HISTORY_LIMIT,
): Promise<Observation[] | null> {
  if (!prisma) return [];
  try {
    const rows = await prisma.attempt.findMany({
      where: { learningSession: { userId, subject } },
      orderBy: { answeredAt: 'desc' },
      take: limit,
      select: {
        topic: true,
        level: true,
        correct: true,
        timeTakenMs: true,
        answeredAt: true,
        offsetMinutes: true,
      },
    });

    return rows
      .map((row) => {
        const level = parseYearLevel(row.level);
        return level
          ? {
              topic: row.topic,
              level,
              correct: row.correct,
              timeTakenMs: row.timeTakenMs,
              answeredAt: row.answeredAt.getTime(),
              offsetMinutes: row.offsetMinutes,
            }
          : undefined;
      })
      .filter((observation) => observation !== undefined)
      .reverse();
  } catch (error) {
    console.error('Failed to read practice history', error);
    return null;
  }
}

/** How many sittings the report lists. Enough to show a pattern, few enough to read. */
const SITTING_LIMIT = 8;

/** One sitting as the parents' report lists it. */
export interface Sitting {
  id: string;
  startedAt: number;
  level: YearLevel;
  attempts: number;
  correct: number;
  /** Summed time on this sitting's questions, each already capped when it was recorded. */
  timeMs: number;
}

/**
 * The child's last few sittings. A weekly total cannot tell five real sessions
 * apart from five ninety-second visits, and that difference is most of what a
 * parent is looking for.
 *
 * `null` on failure, for the same reason `readObservations` does it.
 */
export async function readSittings(
  userId: string,
  subject: string,
  limit = SITTING_LIMIT,
): Promise<Sitting[] | null> {
  if (!prisma) return [];
  try {
    const rows = await prisma.learningSession.findMany({
      where: { userId, subject },
      orderBy: { startedAt: 'desc' },
      take: limit,
      select: {
        id: true,
        startedAt: true,
        level: true,
        attempts: { select: { correct: true, timeTakenMs: true } },
      },
    });

    return rows
      .map((row) => {
        const level = parseYearLevel(row.level);
        // A sitting nobody answered a question in is not a sitting, and listing
        // it would make a child look busier than they were. Dropped after the
        // take rather than before, so this can return fewer than `limit`.
        if (!level || row.attempts.length === 0) return undefined;

        return {
          id: row.id,
          startedAt: row.startedAt.getTime(),
          level,
          attempts: row.attempts.length,
          correct: row.attempts.filter((attempt) => attempt.correct).length,
          timeMs: row.attempts.reduce((total, attempt) => total + attempt.timeTakenMs, 0),
        };
      })
      .filter((sitting) => sitting !== undefined);
  } catch (error) {
    console.error('Failed to read sittings', error);
    return null;
  }
}

export async function recordSessionEnd(userId: string, learningSessionId: string): Promise<void> {
  if (!prisma) return;
  try {
    await prisma.learningSession.updateMany({
      where: { id: learningSessionId, userId },
      data: { endedAt: new Date() },
    });
  } catch (error) {
    console.error('Failed to record session end', error);
  }
}
