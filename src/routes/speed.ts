import type { FastifyPluginAsync } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { requireParent, requireUser } from '../auth/plugin.js';
import { errorSchema } from '../schemas/common.js';
import { MODES, modeKey, parseMode } from '@learnr/core/speedrun/modes';
import {
  dismissSpeedRecords,
  readFamilyRecords,
  readSpeedAttempts,
  readUnseenRecords,
  submitSpeedRun,
} from '../data/speed-records.js';

const MAX_SCORE = 10_000;

export const speedRoutes: FastifyPluginAsync = async (fastify) => {
  const app = fastify.withTypeProvider<ZodTypeProvider>();

  app.get('/speed/modes', {
    schema: { response: { 200: z.array(z.unknown()) } },
  }, async () => MODES.map((mode) => ({ key: modeKey(mode), ...mode })));

  app.post('/speed/runs', {
    schema: {
      body: z.object({
        id: z.uuid(),
        mode: z.string().min(1),
        correct: z.number().int().min(0).max(MAX_SCORE),
      }),
      response: { 200: z.unknown(), 400: errorSchema, 503: errorSchema },
    },
  }, async (request, reply) => {
    const userId = requireUser(request);
    const mode = parseMode(request.body.mode);
    if (!mode) return reply.code(400).send({ error: 'No such mode' });

    const outcome = await submitSpeedRun(userId, mode, request.body.correct);
    if (!outcome) return reply.code(503).send({ error: 'Could not record the run' });

    return reply.send(outcome);
  });

  app.get('/speed/records', {
    schema: { response: { 200: z.unknown(), 503: errorSchema } },
  }, async (request, reply) => {
    const userId = requireUser(request);
    const [attempts, family] = await Promise.all([
      readSpeedAttempts(userId),
      readFamilyRecords(userId),
    ]);

    if (attempts === null || family === null) {
      return reply.code(503).send({ error: 'Could not read the records' });
    }

    return reply.send({ attempts, family });
  });

  app.get('/speed/unseen', {
    schema: { response: { 200: z.array(z.unknown()), 503: errorSchema } },
  }, async (request, reply) => {
    const parentId = await requireParent(request);
    const records = await readUnseenRecords(parentId);
    if (records === null) return reply.code(503).send({ error: 'Could not read the records' });
    return reply.send(records);
  });

  app.delete('/speed/unseen/:childId', {
    schema: { params: z.object({ childId: z.string() }), response: { 204: z.null() } },
  }, async (request, reply) => {
    const parentId = await requireParent(request);
    await dismissSpeedRecords(parentId, request.params.childId);
    return reply.code(204).send(null);
  });
};
