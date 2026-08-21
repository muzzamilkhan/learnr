'use server';

import { auth } from '@/auth';
import { dismissSpeedRecords, submitSpeedRun, type SpeedOutcome } from '@/lib/speed-records';
import { parseMode } from '@/lib/speedrun/modes';

/**
 * Recording only, like the play actions. A run is over by the time either of
 * these is called, so a failure costs a record rather than a game.
 */

/**
 * Bank a finished run. The mode arrives as a key from the browser and is parsed
 * before it is used - `parseMode` is the boundary, and an unrecognised key is a
 * run that never happened rather than a row keyed on junk.
 *
 * The score is the client's word, and it is worth being plain about that: the
 * questions are generated in the browser and answered there, so there is no
 * server-side history to recount a run against, the way `awardRoundStars`
 * recounts a round from stored answers. A speed run banks no stars and touches
 * no learning record, so the worst a forged score can do is put a wrong number
 * on the forger's own cabinet.
 */
export async function submitRunAction(
  modeKey: string,
  correct: number,
): Promise<SpeedOutcome | null> {
  const session = await auth();
  if (!session?.user?.id) return null;

  const mode = parseMode(modeKey);
  if (mode === null) return null;

  // One number now rather than two, since a run only moves on a right answer:
  // the score and the questions answered are the same count. Still bounded
  // before it is stored - never negative, never fractional, never absurd.
  const right = Math.max(0, Math.min(Math.floor(correct) || 0, 10_000));

  return submitSpeedRun(session.user.id, mode, right);
}

export async function dismissRecordsAction(childId: string): Promise<void> {
  const session = await auth();
  if (!session?.user?.id) return;
  await dismissSpeedRecords(session.user.id, childId);
}
