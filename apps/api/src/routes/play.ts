import type { FastifyPluginAsync } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { requireUser } from '../auth/plugin.js';
import { errorSchema, yearLevelSchema } from '../schemas/common.js';
import {
  TARGET_WINDOW_MS,
  readLearnerProfile,
  readPlayerState,
  readRecentAnswers,
  readRecentTopics,
  writeSelectedLevel,
} from '../data/records.js';

export const playRoutes: FastifyPluginAsync = async (fastify) => {
  const app = fastify.withTypeProvider<ZodTypeProvider>();

  /**
   * Everything the play screen needs before it can render its first question.
   *
   * It used to be five reads against Prisma in the same process. Over the wire
   * that would be five round trips before a child sees anything, so it is one
   * call - and `selectedLevel` comes back inside `player`, which is why there is
   * no separate read for it.
   *
   * Best-effort throughout, as the whole play path is: a failed read costs a
   * weighted first question or an empty progress bar, never the question itself.
   */
  app.get('/play/state', {
    schema: {
      querystring: z.object({
        subject: z.string().min(1).default('maths'),
        level: yearLevelSchema,
        recentTopics: z.coerce.number().int().min(1).max(50).default(5),
      }),
      response: { 200: z.unknown() },
    },
  }, async (request, reply) => {
    const userId = requireUser(request);
    const { subject, level, recentTopics: count } = request.query;

    const [profile, recentTopics, player] = await Promise.all([
      readLearnerProfile(userId, subject),
      readRecentTopics(userId, subject, level, count),
      readPlayerState(userId),
    ]);

    // The one read that has to wait for another: there is no point fetching a
    // window of answers for a child with no goal to measure them against. The
    // page made this decision itself and would otherwise pay a round trip for
    // an answer it throws away.
    const targetAnswers = player.target
      ? ((await readRecentAnswers(userId, Date.now() - TARGET_WINDOW_MS)) ?? [])
      : [];

    return reply.send({ player, profile, recentTopics, targetAnswers });
  });

  /** The level a child chose for themselves. A managed child's is their parent's. */
  app.put('/me/level', {
    schema: {
      body: z.object({ level: yearLevelSchema }),
      response: { 204: z.null(), 400: errorSchema },
    },
  }, async (request, reply) => {
    const userId = requireUser(request);
    await writeSelectedLevel(userId, request.body.level);
    return reply.code(204).send(null);
  });
};
