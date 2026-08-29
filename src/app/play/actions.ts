'use server';

import { randomUUID } from 'node:crypto';
import { api } from '@/api';
import type { AttemptResult } from '@/lib/dto';
import type { Attempt } from '@/lib/session/session';
import type { YearLevel } from '@/lib/curriculum';
import { parseOffsetMinutes } from '@/lib/day';
import { parseFigure } from '@/lib/figures/types';
import { timed } from '@/timing';

/**
 * Recording only. These never affect what the child sees next - the session
 * engine runs entirely client side, so a failed write costs history, not play.
 *
 * They are still server actions rather than calls the browser makes itself,
 * because the session cookie is `httpOnly` and the API authenticates by it. The
 * browser says what happened; this forwards it with the proof of who said it.
 *
 * **None of them calls `auth()`, and that is the point of them being this
 * short.** Each one used to open with a session read whose only use was to
 * return early when there was nobody signed in - a Prisma query from Vercel to
 * Neon, on a connection that belongs to a serverless instance and so is cold
 * whenever that instance is. Measured, a fresh one costs about 700ms against
 * about 5ms warm, and a child answering a question was paying it up to twice.
 *
 * It decided nothing. The cookie is forwarded to the API either way, and every
 * route these reach gates on `requireUser` (`apps/api/src/routes/sessions.ts`),
 * which answers 401 on exactly the condition the guard tested; `request` in
 * `src/api.ts` turns that 401 into the same `null` the guard returned. So the
 * check was being made twice, in two places, against the same `Session` table -
 * and only the far one was load-bearing, because it is the one an iOS client
 * that never passes through here is also held to.
 *
 * What is left is a round trip to the API and nothing else. The play path no
 * longer touches Prisma at all: `/play`'s own render still reads the session
 * once, but no answer does.
 */

export async function startRecordingAction(
  subject: string,
  level: YearLevel,
  seed: string,
): Promise<string | null> {
  return timed('action startRecording', () => startRecording(subject, level, seed));
}

async function startRecording(
  subject: string,
  level: YearLevel,
  seed: string,
): Promise<string | null> {
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
  return timed('action recordAttempt', () => recordAttempt(learningSessionId, attempt));
}

async function recordAttempt(
  learningSessionId: string,
  attempt: Attempt,
): Promise<AttemptResult | null> {
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
  return timed('action awardRound', () => awardRound(learningSessionId));
}

async function awardRound(learningSessionId: string): Promise<void> {
  await api.awardRound(learningSessionId);
}

export async function endRecordingAction(learningSessionId: string): Promise<void> {
  return timed('action endRecording', () => endRecording(learningSessionId));
}

async function endRecording(learningSessionId: string): Promise<void> {
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
  return timed('action awardTarget', () => awardTarget(learningSessionId, offsetMinutes));
}

async function awardTarget(
  learningSessionId: string,
  offsetMinutes: number,
): Promise<boolean> {
  const offset = parseOffsetMinutes(offsetMinutes);
  if (offset === null) return false;

  const result = await api.awardTarget(learningSessionId, offset);
  return result?.awarded ?? false;
}
