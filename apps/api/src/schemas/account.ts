import { z } from 'zod';
import { yearLevelSchema } from './common.js';

export const childDetailsSchema = z.object({
  name: z.string().trim().min(1).max(40),
  avatar: z.string().min(1),
  level: yearLevelSchema,
  targetKind: z.enum(['questions', 'minutes']).nullable(),
  targetValue: z.number().int().positive().nullable(),
  photo: z.string().nullable(),
});

export const loginCodeSchema = z.object({
  code: z.string(),
  expiresAt: z.string(),
});
