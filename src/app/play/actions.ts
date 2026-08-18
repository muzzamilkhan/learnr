'use server';

import { auth } from '@/auth';
import {
  awardDailyTarget,
  awardRoundStars,
  recordAttempt,
  recordSessionEnd,
  recordSessionStart,
  type AttemptResult,
} from '@/lib/records';
import type { Attempt } from '@/lib/session/session';
import type { YearLevel } from '@/lib/curriculum';
import { parseOffsetMinutes } from '@/lib/day';

/**
 * Recording only. These never affect what the child sees next - the session
 * engine runs entirely client side, so a failed write costs history, not play.
 */

export async function startRecordingAction(
  subject: string,
  level: YearLevel,
  seed: string,
): Promise<string | null> {
  const session = await auth();
  if (!session?.user?.id) return null;
  return recordSessionStart({ userId: session.user.id, subject, level, seed });
}

/**
 * Returns the play streak so the screen can mark the first answer of a day.
 * Nothing about the next question depends on it, so a null answer here means
 * "no fanfare", never a stall.
 */
export async function recordAttemptAction(
  learningSessionId: string,
  attempt: Attempt,
): Promise<AttemptResult | null> {
  const session = await auth();
  if (!session?.user?.id) return null;
  // The offset is the browser's word, and it ends up in a stored day number, so
  // it is bounded here. An answer with a nonsense offset is still worth keeping;
  // it is recorded at UTC rather than dropped.
  return recordAttempt(session.user.id, learningSessionId, {
    ...attempt,
    offsetMinutes: parseOffsetMinutes(attempt.offsetMinutes) ?? 0,
  });
}

/**
 * Bank the stars for a closed round. The count is recomputed from the answers on
 * the server, so this says only *that* a round finished, never what it was worth.
 */
export async function awardRoundAction(learningSessionId: string): Promise<void> {
  const session = await auth();
  if (!session?.user?.id) return;
  await awardRoundStars(session.user.id, learningSessionId);
}

export async function endRecordingAction(learningSessionId: string): Promise<void> {
  const session = await auth();
  if (!session?.user?.id) return;
  await recordSessionEnd(session.user.id, learningSessionId);
}

/**
 * Bank the day's target, if it has been reached. The server recounts today's
 * answers itself, so this says only *that* an answer landed - never how far
 * along the day is. The offset comes from the client because the server has no
 * timezone, exactly as it does for every recorded answer - and it is bounded
 * before it is used, because the day it produces is written to `User.targetDay`
 * and one absurd value would sit in the future refusing every real day after it.
 */
export async function awardTargetAction(
  learningSessionId: string,
  offsetMinutes: number,
): Promise<{ awarded: boolean; stars: number } | null> {
  const session = await auth();
  if (!session?.user?.id) return null;

  const offset = parseOffsetMinutes(offsetMinutes);
  if (offset === null) return null;

  return awardDailyTarget(session.user.id, learningSessionId, {
    now: Date.now(),
    offsetMinutes: offset,
  });
}
