import { z } from 'zod';
import { idSchema, yearLevelSchema } from './common.js';

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

export const sessionSchema = z.object({ id: idSchema });

export const attemptsBodySchema = z.object({
  attempts: z.array(attemptSchema).min(1).max(200),
});

export const attemptResultSchema = z.object({
  streak: z.number().int().min(0),
  streakAdvanced: z.boolean(),
});
