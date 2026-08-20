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
import { parseFigure } from '@/lib/figures/types';
import { requestNow } from '@/app/now';

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
  const { figure: rawFigure, ...rest } = attempt;
  const figure = parseFigure(rawFigure) ?? undefined;

  return recordAttempt(session.user.id, learningSessionId, {
    ...rest,
    offsetMinutes: parseOffsetMinutes(attempt.offsetMinutes) ?? 0,
    ...(figure ? { figure } : {}),
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

  return awardDailyTarget(session.user.id, learningSessionId, {
    now: requestNow(),
    offsetMinutes: offset,
  });
}
