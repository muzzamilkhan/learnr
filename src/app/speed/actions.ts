'use server';

import { randomUUID } from 'node:crypto';
import { auth } from '@/auth';
import { api } from '@/api';
import type { SpeedOutcome } from '@/lib/dto';
import { modeKey, parseMode } from '@/lib/speedrun/modes';

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
export async function submitRunAction(key: string, correct: number): Promise<SpeedOutcome | null> {
  const session = await auth();
  if (!session?.user?.id) return null;

  // Parsed here as well as at the endpoint, and normalised back to a key: the
  // route rejects a key that is not a mode, and this is what keeps a run that
  // never happened from costing a round trip to find that out.
  const mode = parseMode(key);
  if (mode === null) return null;

  // One number now rather than two, since a run only moves on a right answer:
  // the score and the questions answered are the same count. Still bounded
  // before it is stored - never negative, never fractional, never absurd.
  const right = Math.max(0, Math.min(Math.floor(correct) || 0, 10_000));

  // One id per submission, and the endpoint dedupes on it: `SpeedAttempt.id` is
  // the run rather than the row, so a client that re-sends a run writes it once.
  // Minted here rather than passed in from the browser because this path has no
  // retry queue to replay - the action is called once when a run ends, and a
  // failure costs the run rather than being tried again. A client that *does*
  // queue offline runs has to hold one id per run across every flush of it,
  // which is the whole reason the column stopped defaulting.
  return api.submitSpeedRun({ id: randomUUID(), mode: modeKey(mode), correct: right });
}

export async function dismissRecordsAction(childId: string): Promise<void> {
  const session = await auth();
  if (!session?.user?.id) return;
  await api.dismissRecords(childId);
}
