import { z } from 'zod';

export const yearLevelSchema = z.enum(['K', '1', '2', '3', '4', '5', '6']);

export const idSchema = z.string().min(1).max(64);

/** Every failure answers in this shape, so a client parses one thing. */
export const errorSchema = z.object({
  error: z.string(),
});
