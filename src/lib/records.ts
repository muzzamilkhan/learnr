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

/**
 * One answer folded into the child's running skill for that topic. Read, fold,
 * write: the arithmetic is `nextSkill`, the same step the session applies in
 * memory, so what is stored is what was played.
 */
async function updateTopicSkill(userId: string, attempt: Attempt): Promise<void> {
  if (!prisma) return;

  const where = {
    userId_subject_topic_level: {
      userId,
      subject: attempt.subject,
      topic: attempt.topic,
      level: attempt.level,
    },
  };

  const row = await prisma.topicSkill.findUnique({ where });
  const skill = nextSkill(row ? toSkill(row) : undefined, attempt);

  const values = {
    attempts: skill.attempts,
    correct: skill.correct,
    strength: skill.strength,
    streak: skill.streak,
    totalTimeMs: skill.totalTimeMs,
    lastAnsweredAt: new Date(skill.lastAnsweredAt),
  };

  await prisma.topicSkill.upsert({
    where,
    create: {
      userId,
      subject: attempt.subject,
      topic: attempt.topic,
      level: attempt.level,
      ...values,
    },
    update: values,
  });
}

export async function recordAttempt(
  userId: string,
  learningSessionId: string,
  attempt: Attempt,
): Promise<boolean> {
  if (!prisma) return false;
  try {
    if (!(await ownsSession(userId, learningSessionId))) return false;
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
      },
    });
    await updateTopicSkill(userId, attempt);
    return true;
  } catch (error) {
    console.error('Failed to record attempt', error);
    return false;
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

/** The topics the child last saw, newest first, so a session does not open on one of them. */
export async function readRecentTopics(
  userId: string,
  subject: string,
  level: YearLevel,
  count: number,
): Promise<string[]> {
  if (!prisma) return [];
  try {
    const rows = await prisma.attempt.findMany({
      where: { subject, level, learningSession: { userId } },
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
 */
export async function readObservations(
  userId: string,
  subject: string,
  limit = HISTORY_LIMIT,
): Promise<Observation[]> {
  if (!prisma) return [];
  try {
    const rows = await prisma.attempt.findMany({
      where: { subject, learningSession: { userId } },
      orderBy: { answeredAt: 'desc' },
      take: limit,
      select: { topic: true, level: true, correct: true, timeTakenMs: true, answeredAt: true },
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
            }
          : undefined;
      })
      .filter((observation) => observation !== undefined)
      .reverse();
  } catch (error) {
    console.error('Failed to read practice history', error);
    return [];
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
