import {
  emptyProfile,
  nextSkill,
  type LearnerProfile,
  type Observation,
  type TopicSkill,
} from '@/lib/analytics/profile';
import { EXAMPLE_ANSWERS, type AnsweredQuestion } from '@/lib/analytics/report';
import { parseYearLevel, type YearLevel } from '@/lib/curriculum';
import { prisma } from './db';
import { parseFigure } from '@/lib/figures/types';
import { nextPlayStreak, startedNewDay, noStreak, type PlayStreak } from '@/lib/rewards/streak';
import { rounds } from '@/lib/rewards/stars';
import {
  TARGET_STARS,
  dayProgress,
  dayTotal,
  parseTarget,
  type DailyTarget,
  type TargetAnswer,
} from '@/lib/rewards/target';
import { randomUUID } from 'node:crypto';
import { localDay } from '@/lib/day';
import type { Attempt } from '@/lib/session/session';
import type { AttemptResult, PlayerState, Sitting } from '@/lib/dto';

export type { AttemptResult, PlayerState, Sitting };

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

/**
 * An attempt as the API receives it: the engine's `Attempt` plus the id the
 * client minted for it. Optional so the data layer keeps working for a caller
 * that has no id - the route schema requires one, so every answer arriving over
 * the wire carries it.
 */
export type IdentifiedAttempt = Attempt & { id?: string };

export async function writeSelectedLevel(userId: string, level: YearLevel): Promise<void> {
  if (!prisma) return;
  try {
    await prisma.user.update({ where: { id: userId }, data: { selectedLevel: level } });
  } catch (error) {
    console.error('Failed to write selected level', error);
  }
}

export interface StartRecordInput {
  /** Client-supplied, so an offline sitting can be opened before it syncs. */
  id?: string;
  userId: string;
  subject: string;
  level: YearLevel;
  seed: string;
}

export async function recordSessionStart(input: StartRecordInput): Promise<string | null> {
  if (!prisma) return null;
  try {
    const { id, ...rest } = input;
    const session = await prisma.learningSession.create({
      data: { ...rest, ...(id ? { id } : {}) },
    });
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

/** Postgres' unique violation, as Prisma reports it - someone else created the row first. */
const isUniqueViolation = (error: unknown): boolean =>
  typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002';

/** The row as the lock reads it back. Only `nextSkill` interprets these. */
type StoredSkill = Parameters<typeof toSkill>[0] & { id: string };

/**
 * Only the very first answer on a topic can lose its race - after that the row
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
 * second silently overwrites the first - an answer lost, and this row no longer
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

export async function recordAttempt(
  userId: string,
  learningSessionId: string,
  attempt: IdentifiedAttempt,
): Promise<AttemptResult | null> {
  if (!prisma) return null;
  try {
    if (!(await ownsSession(userId, learningSessionId))) return null;

    // An id the client chose is what makes a flush replayable; one minted here
    // is unique by construction and so never dedupes, which is the old
    // behaviour for callers that have no id to offer.
    const id = attempt.id ?? randomUUID();

    // A retried offline flush re-sends answers already written. The attempt row
    // itself dedupes on that id, but `updateTopicSkill` increments a counter
    // and would count the answer twice - so a replay must skip the fold.
    // `foldPlayStreak` is guarded already (`playStreakDay: { lt: ... }`), so it
    // is safe to run either way, and it is what produces the result the caller
    // expects.
    const already = await prisma.attempt.findUnique({
      where: { id },
      select: { id: true },
    });

    if (already) return await foldPlayStreak(userId, attempt);

    await prisma.attempt.create({
      data: {
        id,
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
        // Stored resolved, as the child actually saw it - see `Attempt.figure`
        // in the Prisma schema for why. Left unset rather than written as
        // `null` for the ordinary question with nothing to draw, which is what
        // every attempt before this column existed already means. Spread
        // rather than passed through: `Figure` is declared as an `interface`
        // (`figures/types.ts`), and an interface gets no implicit index
        // signature, which is the whole of why it doesn't structurally match
        // `InputJsonObject` on its own - nothing to do with the `readonly`
        // arrays inside it, which `InputJsonArray` already accepts. A plain
        // object literal built from its own keys has an index signature and
        // needs no cast, and unlike a cast it keeps tsc checking that `Figure`
        // stays JSON-serialisable - lose that and a later field typed `Date`
        // or `Map` fails silently inside this `try`, costing the attempt.
        ...(attempt.figure ? { figure: { ...attempt.figure } } : {}),
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
 * without claiming the day - a streak counted twice would be worse than one
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
 * Bank the stars for the rounds of a sitting that have not been paid for yet.
 *
 * The worth of a round is still read off the stored answers rather than taken
 * from the client - 3, 2 or 1 depending on how it went, and the browser must not
 * be the one saying which. What is *not* recounted is the total: `User.stars` is
 * incremented by the new rounds only, because a total that can be recomputed is
 * a total a changed daily target could retroactively reduce.
 *
 * `roundsBanked` is what makes that safe. It is read under `SELECT ... FOR
 * UPDATE` and moved up in the same transaction, so a repeated call, a retry, or
 * two tabs answering at once all pay for each round exactly once - the second
 * one through the lock finds the counter already past the round it came to bank.
 * It is the same row lock `updateTopicSkill` takes, for the same reason.
 *
 * The limit of that guard is that the answers are read before the lock, and the
 * counter only ever says how many rounds have been paid for - not which answers
 * were in them. An attempt landing with an `answeredAt` earlier than answers that
 * have already been banked would therefore shuffle itself into a round somebody
 * has been paid for, and because the total is incremented rather than recounted,
 * that round keeps the valuation it was paid at. The old recount corrected itself
 * in that case; this does not. It is accepted because answers are written as they
 * are given and a child plays one question at a time, so a late-dated attempt is
 * not something ordinary play produces.
 *
 * Returns the child's new total, or null if nothing was banked.
 */
export async function awardRoundStars(
  userId: string,
  learningSessionId: string,
): Promise<number | null> {
  if (!prisma) return null;
  const db = prisma;
  try {
    if (!(await ownsSession(userId, learningSessionId))) return null;

    const answers = await db.attempt.findMany({
      where: { learningSessionId },
      // The same order the round chunking assumes: as they were answered, with
      // the id settling a tie so two calls cannot chunk the sitting differently.
      orderBy: [{ answeredAt: 'asc' }, { id: 'asc' }],
      select: { correct: true },
    });
    const closed = rounds(answers.map((answer) => answer.correct));

    return await db.$transaction(async (tx) => {
      const locked = await tx.$queryRaw<{ roundsBanked: number }[]>`
        SELECT "roundsBanked"
        FROM "LearningSession"
        WHERE "id" = ${learningSessionId}
        FOR UPDATE
      `;

      const banked = locked[0]?.roundsBanked;
      if (banked === undefined || closed.length <= banked) return null;

      const gained = closed.slice(banked).reduce((total, round) => total + round.stars, 0);

      await tx.learningSession.update({
        where: { id: learningSessionId },
        data: { roundsBanked: closed.length },
      });
      const user = await tx.user.update({
        where: { id: userId },
        data: { stars: { increment: gained } },
        select: { stars: true },
      });

      return user.stars;
    });
  } catch (error) {
    console.error('Failed to award stars', error);
    return null;
  }
}

const noPlayerState = (): PlayerState => ({
  selectedLevel: null,
  subjects: [],
  streak: noStreak(),
  stars: 0,
  target: null,
  targetDay: null,
});

export async function readPlayerState(userId: string): Promise<PlayerState> {
  if (!prisma) return noPlayerState();
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        selectedLevel: true,
        subjects: true,
        playStreak: true,
        playStreakDay: true,
        stars: true,
        targetKind: true,
        targetValue: true,
        targetDay: true,
      },
    });
    if (!user) return noPlayerState();

    return {
      selectedLevel: user.selectedLevel,
      subjects: user.subjects,
      streak: { days: user.playStreak, lastDay: user.playStreakDay },
      stars: user.stars,
      target: parseTarget(user.targetKind, user.targetValue),
      targetDay: user.targetDay,
    };
  } catch (error) {
    console.error('Failed to read player state', error);
    return noPlayerState();
  }
}

/** A child's target, and the last day its stars were banked. */
export interface TargetSettings {
  target: DailyTarget | null;
  targetDay: number | null;
}

const noTarget = (): TargetSettings => ({ target: null, targetDay: null });

export async function readTargetSettings(userId: string): Promise<TargetSettings> {
  if (!prisma) return noTarget();
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { targetKind: true, targetValue: true, targetDay: true },
    });
    if (!user) return noTarget();
    return { target: parseTarget(user.targetKind, user.targetValue), targetDay: user.targetDay };
  } catch (error) {
    console.error('Failed to read daily target', error);
    return noTarget();
  }
}

/**
 * A child's answers since a moment, across every subject and sitting.
 *
 * Deliberately not scoped to a subject the way `readObservations` is: a target
 * is the child's whole day, and a child who does twenty questions of maths has
 * done twenty questions whichever screen they were on.
 *
 * It returns the answers rather than a total because the server does not know
 * what day it is where the child is. The device does, so the fold into "today"
 * happens there - the same reason `currentStreak` is computed in the browser.
 *
 * Not best-effort, for the parent's sake: `null` means the read failed and `[]`
 * means nothing was recorded, because the calendar draws an empty read as a
 * month of days that missed their goal. That is a lie a parent has no way to
 * spot - the rest of that panel renders fine from a separate, successful read.
 * The play screens, where an empty bar is only a bar, take `?? []`.
 */
export async function readRecentAnswers(
  userId: string,
  sinceMs: number,
): Promise<TargetAnswer[] | null> {
  if (!prisma) return [];
  try {
    const rows = await prisma.attempt.findMany({
      where: { learningSession: { userId }, answeredAt: { gte: new Date(sinceMs) } },
      orderBy: { answeredAt: 'asc' },
      select: { answeredAt: true, timeTakenMs: true },
    });
    return rows.map((row) => ({
      answeredAt: row.answeredAt.getTime(),
      timeTakenMs: row.timeTakenMs,
    }));
  } catch (error) {
    console.error('Failed to read recent answers', error);
    return null;
  }
}

/**
 * Two days of answers is all a target ever needs, whichever side of midnight the
 * child's own clock is on. Exported because the screens that render a target
 * read the same window, and two of them disagreeing about it would show a bar
 * that disagreed with the award.
 */
export const TARGET_WINDOW_MS = 2 * 24 * 60 * 60 * 1000;

/**
 * Bank the day's target stars, if today's answers have reached the target.
 *
 * The recount is per child and per day rather than per sitting: a target is not
 * subject-specific, and a child may well switch subject or level part way
 * through an evening.
 *
 * The `where` on `targetDay` is the whole of the guard, in one statement, in the
 * shape the play streak already uses. Two tabs answering at once, a retried call
 * and a client that fires this on every answer of the evening all award exactly
 * once - the second write matches no row and reports nothing awarded.
 *
 * Best-effort like every other write on the play path: a missed award costs ten
 * stars and repairs itself on the child's next answer of the day, which is a far
 * better failure than an interrupted question.
 *
 * Answers whether the ten stars were just paid, and nothing else. It is asked on
 * every answer until the day is done, so the one thing it must not do is read
 * anything the caller does not need: the play screen already knows what a target
 * is worth and adds `TARGET_STARS` to the total it is showing, so handing back a
 * recounted total would be a query per question for a number nobody looks at.
 */
export async function awardDailyTarget(
  userId: string,
  learningSessionId: string,
  { now, offsetMinutes }: { now: number; offsetMinutes: number },
): Promise<boolean> {
  if (!prisma) return false;
  try {
    if (!(await ownsSession(userId, learningSessionId))) return false;

    const { target } = await readTargetSettings(userId);
    if (!target) return false;

    // Best-effort on this side: a failed read means no award this call, and the
    // child's next answer of the day tries again.
    const answers = (await readRecentAnswers(userId, now - TARGET_WINDOW_MS)) ?? [];
    if (!dayProgress(target, dayTotal(answers, { now, offsetMinutes })).complete) return false;

    const today = localDay(now, offsetMinutes);
    const written = await prisma.user.updateMany({
      where: { id: userId, OR: [{ targetDay: null }, { targetDay: { lt: today } }] },
      data: { targetDay: today, stars: { increment: TARGET_STARS } },
    });

    return written.count > 0;
  } catch (error) {
    console.error('Failed to award daily target', error);
    return false;
  }
}

/**
 * A stored skill row as the engines see it. A level that is no longer a school
 * year is dropped rather than guessed at - content is the source of truth, and a
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
 * are the same thing - a sitting is one subject and one year, and its attempts
 * can be no other - but putting the whole predicate on one side lets the planner
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
        // Carried for the parent's report alone - nothing that folds a profile
        // or picks the next question reads it. See `Observation.templateId`.
        templateId: true,
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
              templateId: row.templateId,
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

/**
 * The last few answers on every topic the child has practised in this subject -
 * the question as they saw it, what they answered, and what it should have been.
 *
 * The report only unfolds these for the topics that are going badly, and which
 * those are is decided by `topicReports` over history this read knows nothing
 * about. So it fetches the last few for *every* topic rather than being told
 * which to fetch: a subject's topics number in the dozens, three answers each is
 * a small read, and the alternative - taking the last few hundred attempts and
 * hoping a struggling topic is among them - would quietly show nothing for a
 * topic the child last got wrong a while ago, which is exactly the topic a
 * parent has come here to look at.
 *
 * That is what the window function is for. One query, three rows per topic, and
 * the database does the per-topic slicing rather than the app throwing away most
 * of what it read.
 *
 * `null` on failure, like `readObservations` and `readSittings`: the panel says
 * it could not fetch them rather than drawing a topic as having no history.
 */
export async function readAnsweredQuestions(
  userId: string,
  subject: string,
  perTopic = EXAMPLE_ANSWERS,
): Promise<AnsweredQuestion[] | null> {
  if (!prisma) return [];
  try {
    const rows = await prisma.$queryRaw<
      {
        topic: string;
        level: string;
        prompt: string;
        expected: string;
        response: string;
        correct: boolean;
        answeredAt: Date;
        figure: unknown;
      }[]
    >`
      SELECT "topic", "level", "prompt", "expected", "response", "correct", "answeredAt", "figure"
      FROM (
        SELECT a."topic", a."level", a."prompt", a."expected", a."response", a."correct",
               a."answeredAt", a."figure",
               ROW_NUMBER() OVER (
                 PARTITION BY a."topic", a."level"
                 -- The id settles a tie, so two reads cannot pick different answers.
                 ORDER BY a."answeredAt" DESC, a."id" DESC
               ) AS place
        FROM "Attempt" a
        JOIN "LearningSession" s ON s."id" = a."learningSessionId"
        WHERE s."userId" = ${userId} AND s."subject" = ${subject}
      ) ranked
      WHERE "place" <= ${perTopic}
    `;

    return rows
      .map((row) => {
        const level = parseYearLevel(row.level);
        if (!level) return undefined;
        // Undefined rather than null when there is nothing to draw, so a
        // question with no figure has no `figure` key at all - matching how
        // it round-tripped through `Attempt` on the way in.
        const figure = parseFigure(row.figure) ?? undefined;
        return {
          topic: row.topic,
          level,
          prompt: row.prompt,
          expected: row.expected,
          response: row.response,
          correct: row.correct,
          answeredAt: row.answeredAt.getTime(),
          ...(figure ? { figure } : {}),
        };
      })
      .filter((answer) => answer !== undefined);
  } catch (error) {
    console.error('Failed to read answered questions', error);
    return null;
  }
}

/** How many sittings the report lists. Enough to show a pattern, few enough to read. */
const SITTING_LIMIT = 8;

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
