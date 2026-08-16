'use server';

import { auth } from '@/auth';
import { recordAttempt, recordSessionEnd, recordSessionStart } from '@/lib/records';
import type { Attempt } from '@/lib/session/session';

/**
 * Recording only. These never affect what the child sees next — the session
 * engine runs entirely client side, so a failed write costs history, not play.
 */

export async function startRecordingAction(
  subject: string,
  level: number,
  seed: string,
): Promise<string | null> {
  const session = await auth();
  if (!session?.user?.id) return null;
  return recordSessionStart({ userId: session.user.id, subject, level, seed });
}

export async function recordAttemptAction(
  learningSessionId: string,
  attempt: Attempt,
): Promise<void> {
  const session = await auth();
  if (!session?.user?.id) return;
  await recordAttempt(session.user.id, learningSessionId, attempt);
}

export async function endRecordingAction(learningSessionId: string): Promise<void> {
  const session = await auth();
  if (!session?.user?.id) return;
  await recordSessionEnd(session.user.id, learningSessionId);
}
