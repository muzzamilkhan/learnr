import { z } from 'zod';
import { idSchema } from './common.js';

/**
 * The request schemas moved to the repository root
 * (`src/app/api/v1/schemas.ts`) as part of collapsing the API back into the
 * web app - `apps/api` is deleted whole in a later step of that collapse.
 * This shim exists only to keep the workspace typechecking cleanly until
 * then.
 *
 * The response schemas below (`attemptResultSchema`, `sessionSchema`) were
 * deleted from the root file - nothing serialises through them there any
 * more - but this Fastify route still declares its own response shape, so
 * they are kept here, local to the code that still needs them.
 */
export {
  attemptSchema,
  attemptsBodySchema,
  createSessionSchema,
} from '../../../../src/app/api/v1/schemas';

export const sessionSchema = z.object({ id: idSchema });

export const attemptResultSchema = z.object({
  streak: z.number().int().min(0),
  streakAdvanced: z.boolean(),
});
