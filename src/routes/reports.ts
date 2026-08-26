import type { FastifyPluginAsync } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { requireParent } from '../auth/plugin.js';
import { errorSchema } from '../schemas/common.js';
import { readViewableChildren } from '../data/sharing.js';
import { readAnsweredQuestions, readObservations, readSittings } from '../data/records.js';
import {
  dueForReview,
  headline,
  problemTopics,
  progressOverTime,
  strengths,
  topicReports,
} from '@learnr/core/analytics/report';
import { errorClusters } from '@learnr/core/analytics/errors';

/** A parent may read a child they own, or one shared with them - and no other. */
async function mayRead(parentId: string, childId: string): Promise<boolean> {
  const viewable = await readViewableChildren(parentId);
  return Boolean(viewable?.some((child) => child.id === childId));
}

export const reportRoutes: FastifyPluginAsync = async (fastify) => {
  const app = fastify.withTypeProvider<ZodTypeProvider>();

  app.get('/children/:id/report', {
    schema: {
      params: z.object({ id: z.string() }),
      querystring: z.object({ subject: z.string().default('maths') }),
      response: { 200: z.unknown(), 404: errorSchema, 503: errorSchema },
    },
  }, async (request, reply) => {
    const parentId = await requireParent(request);
    const { id } = request.params;
    const { subject } = request.query;

    if (!(await mayRead(parentId, id))) return reply.code(404).send({ error: 'No such child' });

    const observations = await readObservations(id, subject);
    const answers = await readAnsweredQuestions(id, subject);
    const sittings = await readSittings(id, subject);

    if (observations === null || answers === null || sittings === null) {
      return reply.code(503).send({ error: 'Could not read the record' });
    }

    const now = Date.now();
    const reports = topicReports(observations, now);

    return reply.send({
      headline: headline(observations, { now }),
      topics: reports,
      problems: problemTopics(reports),
      due: dueForReview(reports),
      strengths: strengths(reports),
      progress: progressOverTime(observations, { now }),
      clusters: errorClusters(answers),
      sittings,
    });
  });

  app.get('/children/:id/answers', {
    schema: {
      params: z.object({ id: z.string() }),
      querystring: z.object({
        subject: z.string().default('maths'),
        // The third argument to readAnsweredQuestions is answers *per topic*,
        // not a row cap - it defaults to EXAMPLE_ANSWERS (3). Naming it
        // `limit` here would quietly change what the parent screen asks for.
        perTopic: z.coerce.number().int().min(1).max(50).default(3),
      }),
      response: { 200: z.array(z.unknown()), 404: errorSchema, 503: errorSchema },
    },
  }, async (request, reply) => {
    const parentId = await requireParent(request);
    const { id } = request.params;

    if (!(await mayRead(parentId, id))) return reply.code(404).send({ error: 'No such child' });

    const answers = await readAnsweredQuestions(id, request.query.subject, request.query.perTopic);
    if (answers === null) return reply.code(503).send({ error: 'Could not read the answers' });

    return reply.send(answers);
  });
};
