import type { FastifyPluginAsync } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { requireParent, requireUser } from '../auth/plugin.js';
import { errorSchema } from '../schemas/common.js';
import {
  childRecordSchema,
  modeListingSchema,
  speedOutcomeSchema,
  speedRecordsSchema,
  summaryRunSchema,
} from '../schemas/dto.js';
import { MODES, modeKey, parseMode } from '@learnr/core/speedrun/modes';
import { parsePlayedAt } from '@learnr/core/day';
import { householdId } from '@learnr/core/children';
import { readAccount } from '../data/accounts.js';
import {
  dismissSpeedRecords,
  readFamilyRecords,
  readSpeedAttempts,
  readSpeedSummaries,
  readUnseenRecords,
  submitSpeedRun,
} from '../data/speed-records.js';

const MAX_SCORE = 10_000;

export const speedRoutes: FastifyPluginAsync = async (fastify) => {
  const app = fastify.withTypeProvider<ZodTypeProvider>();

  app.get('/speed/modes', {
    schema: {
      operationId: 'listSpeedModes',
      response: { 200: z.array(modeListingSchema) },
    },
  }, async () => MODES.map((mode) => ({ key: modeKey(mode), ...mode })));

  /**
   * Bank a finished run.
   *
   * **`playedAt` says when the run was played, and the server no longer
   * assumes that is now.** A client with an offline queue flushes a run
   * whenever connectivity returns, and the stamp orders the cabinet, the report
   * table and the family board and tie-breaks which run gets starred - so an
   * afternoon of offline runs used to land in one minute that evening, in
   * whatever order the queue drained, under a "latest run" a parent reads as
   * when their child played.
   *
   * It is **optional and loosely typed on purpose**, which is the difference
   * between it and `mode`. An unparseable mode is a run that never happened and
   * earns the 400; an unparseable stamp costs nothing but itself, so
   * `parsePlayedAt` bounds it and the run falls back to the server's clock -
   * exactly what happened before any client sent one. A client bug in the stamp
   * must not be able to destroy every run a build submits.
   *
   * The contract still advertises `format: date-time`, because that is what a
   * client should send and what a generated model should carry. Being lenient
   * about what arrives is not the same as being vague about what is wanted.
   */
  app.post('/speed/runs', {
    schema: {
      operationId: 'submitSpeedRun',
      body: z.object({
        id: z.uuid(),
        mode: z.string().min(1),
        correct: z.number().int().min(0).max(MAX_SCORE),
        playedAt: z
          .string()
          .meta({
            format: 'date-time',
            description:
              'When the run was played, ISO 8601. Omit it and the server stamps receipt. '
              + 'Hold one stamp per run across every flush of it, as with `id`.',
          })
          .optional(),
      }),
      response: { 200: speedOutcomeSchema, 400: errorSchema, 503: errorSchema },
    },
  }, async (request, reply) => {
    const userId = requireUser(request);
    const mode = parseMode(request.body.mode);
    if (!mode) return reply.code(400).send({ error: 'No such mode' });

    const playedAt = parsePlayedAt(request.body.playedAt, Date.now()) ?? new Date();

    const outcome = await submitSpeedRun(userId, {
      id: request.body.id, mode, correct: request.body.correct, playedAt,
    });
    if (!outcome) return reply.code(503).send({ error: 'Could not record the run' });

    return reply.send(outcome);
  });

  /**
   * Both walls of the scores screen: this player's own runs, and the household
   * they are ranked inside.
   *
   * **The board ranks a household, which is not the caller.** `householdId` is
   * a parent's own id and a child's *parent's* - so handing `userId` to
   * `readFamilyRecords` would have ranked a child against the rows belonging to
   * them and to anyone whose `parentId` is the child, which is nobody. A board
   * of one, silently, on every child's screen.
   *
   * `family: null` beside a 200 is the third state that needs saying: a child on
   * their own Google account and a parent with no children have no household at
   * all, and a board of one is not a leaderboard. A read that actually broke is
   * the 503, so the screen can tell "nobody to rank" from "try again in a
   * moment".
   */
  app.get('/speed/records', {
    schema: {
      operationId: 'readFamilyRecords',
      response: { 200: speedRecordsSchema, 503: errorSchema },
    },
  }, async (request, reply) => {
    const userId = requireUser(request);

    const account = await readAccount(userId);
    const household = account ? householdId(account) : null;

    const [attempts, family] = await Promise.all([
      readSpeedAttempts(userId),
      household === null ? Promise.resolve(null) : readFamilyRecords(household),
    ]);

    if (attempts === null || (household !== null && family === null)) {
      return reply.code(503).send({ error: 'Could not read the records' });
    }

    return reply.send({ attempts, family });
  });

  /** One line per mode this player has run - the cabinet's table. */
  app.get('/speed/summaries', {
    schema: {
      operationId: 'readSpeedSummaries',
      response: { 200: z.array(summaryRunSchema), 503: errorSchema },
    },
  }, async (request, reply) => {
    const userId = requireUser(request);
    const summaries = await readSpeedSummaries(userId);
    if (summaries === null) return reply.code(503).send({ error: 'Could not read the runs' });
    return reply.send(summaries);
  });

  app.get('/speed/unseen', {
    schema: {
      operationId: 'readUnseenRecords',
      response: { 200: z.array(childRecordSchema), 503: errorSchema },
    },
  }, async (request, reply) => {
    const parentId = await requireParent(request);
    const records = await readUnseenRecords(parentId);
    if (records === null) return reply.code(503).send({ error: 'Could not read the records' });
    return reply.send(records);
  });

  app.delete('/speed/unseen/:childId', {
    schema: {
      operationId: 'dismissSpeedRecords',
      params: z.object({ childId: z.string() }),
      response: { 204: z.null() },
    },
  }, async (request, reply) => {
    const parentId = await requireParent(request);
    await dismissSpeedRecords(parentId, request.params.childId);
    return reply.code(204).send(null);
  });
};
