import 'server-only';
import { prisma } from './db';
import type { Attempt } from './session/session';

/**
 * Recording is fire-and-forget and best effort: a child answering questions must
 * never be blocked or interrupted by a database problem. Nothing reads these rows
 * yet — they exist so the future reinforcement pass has history to work from.
 */

export interface StartRecordInput {
  userId: string;
  subject: string;
  level: number;
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
        category: attempt.category,
        level: attempt.level,
        prompt: attempt.prompt,
        expected: attempt.expected,
        response: attempt.response,
        correct: attempt.correct,
        timeTakenMs: attempt.timeTakenMs,
        answeredAt: new Date(attempt.answeredAt),
      },
    });
    return true;
  } catch (error) {
    console.error('Failed to record attempt', error);
    return false;
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
