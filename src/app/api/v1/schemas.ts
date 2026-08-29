import { z } from 'zod';

/**
 * Request schemas only. A response schema was a serializer in the API - it
 * silently stripped whatever a route handed back that it hadn't declared,
 * which is why `Mirrored` existed to hold it against the DTOs. Nothing
 * serialises through a schema now, so a response schema here would be a
 * second declaration of a shape with no way to be wrong until it drifted.
 */

const yearLevelSchema = z.enum(['K', '1', '2', '3', '4', '5', '6']);

export const attemptSchema = z.object({
  id: z.uuid(),
  templateId: z.string().min(1),
  subject: z.string().min(1),
  topic: z.string().min(1),
  level: yearLevelSchema,
  prompt: z.string(),
  expected: z.string(),
  response: z.string(),
  correct: z.boolean(),
  timeTakenMs: z.number().int().min(0),
  answeredAt: z.number().int(),
  offsetMinutes: z.number().int().min(-840).max(840),
  figure: z.unknown().optional(),
});

export const createSessionSchema = z.object({
  id: z.uuid(),
  subject: z.string().min(1),
  level: yearLevelSchema,
  seed: z.string().min(1),
});

export const attemptsBodySchema = z.object({
  attempts: z.array(attemptSchema).min(1).max(200),
});

export const awardTargetBodySchema = z.object({
  offsetMinutes: z.number().int().min(-840).max(840),
});

const MAX_SCORE = 10_000;

/**
 * `playedAt` is gone. It existed for an offline queue no client here has - the
 * browser has never sent it, and `SpeedAttempt.playedAt` keeps its
 * `@default(now())` as the fallback it always was.
 */
export const submitSpeedRunSchema = z.object({
  id: z.uuid(),
  mode: z.string().min(1),
  correct: z.number().int().min(0).max(MAX_SCORE),
});
