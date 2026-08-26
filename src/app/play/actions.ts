'use server';

import { randomUUID } from 'node:crypto';
import { auth } from '@/auth';
import { api } from '@/api';
import type { AttemptResult } from '@/lib/dto';
import type { Attempt } from '@/lib/session/session';
import type { YearLevel } from '@/lib/curriculum';
import { parseOffsetMinutes } from '@/lib/day';
import { parseFigure } from '@/lib/figures/types';

/**
 * Recording only. These never affect what the child sees next - the session
 * engine runs entirely client side, so a failed write costs history, not play.
 *
 * They are still server actions rather than calls the browser makes itself,
 * because the session cookie is `httpOnly` and the API authenticates by it. The
 * browser says what happened; this forwards it with the proof of who said it.
 */

export async function startRecordingAction(
  subject: string,
  level: YearLevel,
  seed: string,
): Promise<string | null> {
  const session = await auth();
  if (!session?.user?.id) return null;

  // The id is minted here rather than by the database, so a retried call opens
  // the same sitting rather than a second one - `POST /sessions` answers 200 to
  // an id it has already seen. That is also the shape the offline iOS client
  // needs, where a sitting starts with no network at all.
  const id = randomUUID();
  const started = await api.startSession({ id, subject, level, seed });
  return started?.id ?? null;
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
  //
  // The figure is bounded here too, and for a sharper reason: `prompt` and
  // `response` are already unvalidated client strings by design - the design
  // doc's boundary for a figure is explicitly "on the way back out", the same
  // read `readAnsweredQuestions` already guards - but `figure` is structured
  // data, and a hand-rolled call to this action is not bound to what a
  // session ever produces. Without a check here, a crafted `{ marks: [...
  // tens of thousands of dots] }` would be stored verbatim and then rendered
  // as that many SVG nodes inside a parent's report. `parseFigure` (with its
  // `MAX_MARKS` cap) is the same normaliser the report already trusts, run at
  // the same seam `parsePhoto` uses inbound, and destructured out of `attempt`
  // first so an invalid figure cannot ride through on the `...rest` spread -
  // the answer is still recorded, just without a figure that failed to parse.
  //
  // The endpoint parses it again, because it is reachable by a client this app
  // does not write. Neither check makes the other redundant: this one is what
  // keeps a bad figure from costing the answer it came with.
  const { figure: rawFigure, ...rest } = attempt;
  const figure = parseFigure(rawFigure) ?? undefined;

  // One answer at a time from this app - a child answers one at a time. The
  // endpoint takes a batch because the offline client flushes a queue.
  return api.recordAttempts(learningSessionId, [
    {
      ...rest,
      id: randomUUID(),
      offsetMinutes: parseOffsetMinutes(attempt.offsetMinutes) ?? 0,
      ...(figure ? { figure } : {}),
    },
  ]);
}

/**
 * Bank the stars for a closed round. The count is recomputed from the answers on
 * the server, so this says only *that* a round finished, never what it was worth.
 */
export async function awardRoundAction(learningSessionId: string): Promise<void> {
  const session = await auth();
  if (!session?.user?.id) return;
  await api.awardRound(learningSessionId);
}

export async function endRecordingAction(learningSessionId: string): Promise<void> {
  const session = await auth();
  if (!session?.user?.id) return;
  await api.endSession(learningSessionId);
}

/**
 * Bank the day's target, if it has been reached, and say whether it just was.
 * The server recounts today's answers itself, so this says only *that* an answer
 * landed - never how far along the day is. The offset comes from the client because the server has no
 * timezone, exactly as it does for every recorded answer - and it is bounded
 * before it is used, because the day it produces is written to `User.targetDay`
 * and one absurd value would sit in the future refusing every real day after it.
 */
export async function awardTargetAction(
  learningSessionId: string,
  offsetMinutes: number,
): Promise<boolean> {
  const session = await auth();
  if (!session?.user?.id) return false;

  const offset = parseOffsetMinutes(offsetMinutes);
  if (offset === null) return false;

  const result = await api.awardTarget(learningSessionId, offset);
  return result?.awarded ?? false;
}
