import type { FastifyPluginAsync } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { parseFigure } from '@learnr/core/figures/types';
import { requireUser } from '../auth/plugin.js';
import { errorSchema } from '../schemas/common.js';
import { prisma } from '../db.js';
import {
  attemptResultSchema,
  attemptsBodySchema,
  createSessionSchema,
  sessionSchema,
} from '../schemas/play.js';
import {
  awardDailyTarget,
  awardRoundStars,
  recordAttempt,
  recordSessionEnd,
  recordSessionStart,
} from '../data/records.js';

export const sessionRoutes: FastifyPluginAsync = async (fastify) => {
  const app = fastify.withTypeProvider<ZodTypeProvider>();

  /**
   * The id comes from the client so a child can open a sitting with no network
   * and reconcile later, and so one sitting can never be confused with another.
   * Repeating the call is how a retried flush behaves, so it answers 200 rather
   * than opening a second row.
   */
  app.post('/sessions', {
    schema: {
      operationId: 'startSession',
      body: createSessionSchema,
      response: { 200: sessionSchema, 201: sessionSchema, 503: errorSchema },
    },
  }, async (request, reply) => {
    const userId = requireUser(request);
    const { id, subject, level, seed } = request.body;

    const existing = await prisma?.learningSession.findFirst({
      where: { id, userId },
      select: { id: true },
    });

    if (existing) return reply.code(200).send({ id });

    const created = await recordSessionStart({ id, userId, subject, level, seed });
    if (!created) return reply.code(503).send({ error: 'Could not open the sitting' });

    return reply.code(201).send({ id: created });
  });

  app.post('/sessions/:id/attempts', {
    schema: {
      operationId: 'recordAttempt',
      params: z.object({ id: z.string() }),
      body: attemptsBodySchema,
      response: { 200: attemptResultSchema, 404: errorSchema },
    },
  }, async (request, reply) => {
    const userId = requireUser(request);
    const { id } = request.params;

    let last = { streak: 0, streakAdvanced: false };

    for (const { figure, ...attempt } of request.body.attempts) {
      // Anything that is not a well-formed Figure is dropped rather than
      // stored: a malformed drawing must not cost the answer it came with.
      const parsed = figure === undefined ? undefined : (parseFigure(figure) ?? undefined);
      const result = await recordAttempt(userId, id, { ...attempt, figure: parsed });
      if (!result) return reply.code(404).send({ error: 'No such sitting' });
      last = result;
    }

    return reply.send(last);
  });

  app.post('/sessions/:id/award-round', {
    schema: {
      operationId: 'awardRound',
      params: z.object({ id: z.string() }),
      response: { 200: z.object({ stars: z.number().int().nullable() }) },
    },
  }, async (request, reply) => {
    const userId = requireUser(request);
    const stars = await awardRoundStars(userId, request.params.id);
    return reply.send({ stars });
  });

  app.post('/sessions/:id/award-target', {
    schema: {
      operationId: 'awardDailyTarget',
      params: z.object({ id: z.string() }),
      body: z.object({ offsetMinutes: z.number().int().min(-840).max(840) }),
      response: { 200: z.object({ awarded: z.boolean() }) },
    },
  }, async (request, reply) => {
    const userId = requireUser(request);
    const awarded = await awardDailyTarget(userId, request.params.id, {
      now: Date.now(),
      offsetMinutes: request.body.offsetMinutes,
    });
    return reply.send({ awarded });
  });

  app.post('/sessions/:id/end', {
    schema: {
      operationId: 'endSession',
      params: z.object({ id: z.string() }),
      response: { 204: z.null() },
    },
  }, async (request, reply) => {
    const userId = requireUser(request);
    await recordSessionEnd(userId, request.params.id);
    return reply.code(204).send(null);
  });
};
