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

/**
 * The window of answers the goal bar folds, fetched only for a child who has a
 * goal to measure them against.
 *
 * The server keeps the clock and the caller keeps the calendar: which of these
 * answers is "today" is decided on the child's device, because the server has
 * no timezone. A failed read costs an empty bar and never the screen, so it
 * falls back to nothing rather than propagating null.
 */
async function targetAnswersFor(
  userId: string,
  target: unknown,
): Promise<Awaited<ReturnType<typeof readRecentAnswers>>> {
  if (!target) return [];
  return (await readRecentAnswers(userId, Date.now() - TARGET_WINDOW_MS)) ?? [];
}

export const playRoutes: FastifyPluginAsync = async (fastify) => {
  const app = fastify.withTypeProvider<ZodTypeProvider>();

  /**
   * The four numbers on the child's own row, and the goal window that goes with
   * them - `/play/state` without the two reads that need a course.
   *
   * The home screen is where a child *picks* a subject and a year, so it has
   * neither to ask about. Sending it through `/play/state` would mean inventing
   * a level to satisfy the endpoint and paying for a learner profile nobody
   * renders; this is the same shape minus what the play screen alone needs.
   */
  app.get('/me/player', {
    schema: { response: { 200: z.unknown() } },
  }, async (request, reply) => {
    const userId = requireUser(request);
    const player = await readPlayerState(userId);

    return reply.send({ player, targetAnswers: await targetAnswersFor(userId, player.target) });
  });

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
   *
   * **`level` is optional, and the reason is the redirect.** A managed child's
   * year is their parent's decision, enforced against the one in the URL - so
   * the screen has to read `player.selectedLevel` *before* it knows whether the
   * URL's year is allowed, and the URL's year may be nonsense. Refusing a level
   * that is not a school year would 400 the very read that would have sent the
   * child to their own. Without one there is no course to draw recent topics
   * from, so that half comes back empty and the rest is unchanged.
   */
  app.get('/play/state', {
    schema: {
      querystring: z.object({
        subject: z.string().min(1).default('maths'),
        level: yearLevelSchema.optional(),
        recentTopics: z.coerce.number().int().min(1).max(50).default(5),
      }),
      response: { 200: z.unknown() },
    },
  }, async (request, reply) => {
    const userId = requireUser(request);
    const { subject, level, recentTopics: count } = request.query;

    const [profile, recentTopics, player] = await Promise.all([
      readLearnerProfile(userId, subject),
      level ? readRecentTopics(userId, subject, level, count) : Promise.resolve([]),
      readPlayerState(userId),
    ]);

    // The one read that has to wait for another: there is no point fetching a
    // window of answers for a child with no goal to measure them against. The
    // page made this decision itself and would otherwise pay a round trip for
    // an answer it throws away.
    const targetAnswers = await targetAnswersFor(userId, player.target);

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
