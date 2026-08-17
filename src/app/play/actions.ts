'use server';

import { auth } from '@/auth';
import {
  awardRoundStars,
  recordAttempt,
  recordSessionEnd,
  recordSessionStart,
  type AttemptResult,
} from '@/lib/records';
import type { Attempt } from '@/lib/session/session';
import type { YearLevel } from '@/lib/curriculum';

/**
 * Recording only. These never affect what the child sees next — the session
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
  return recordAttempt(session.user.id, learningSessionId, attempt);
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
