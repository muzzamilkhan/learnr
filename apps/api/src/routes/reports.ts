import type { FastifyPluginAsync } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { requireParent } from '../auth/plugin.js';
import { errorSchema } from '../schemas/common.js';
import {
  answeredQuestionSchema,
  childHistorySchema,
  reportSchema,
} from '../schemas/dto.js';
import { readViewableChildren } from '../data/sharing.js';
import {
  readAnsweredQuestions,
  readObservations,
  readRecentAnswers,
  readSittings,
} from '../data/records.js';
import { readSpeedSummaries } from '../data/speed-records.js';
import {
  EXAMPLE_ANSWERS,
  dueForReview,
  headline,
  problemTopics,
  progressOverTime,
  strengths,
  topicReports,
} from '@learnr/core/analytics/report';
import { errorClusters } from '@learnr/core/analytics/errors';

/**
 * How far back the calendar's read may reach: four Monday-to-Sunday weeks and a
 * margin, which is the widest window any caller has a use for. A cap as well as
 * a default - the window decides how many rows a single request reads, and it
 * arrives off a URL.
 */
const CALENDAR_WINDOW_MS = 29 * 24 * 60 * 60 * 1000;

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
      response: { 200: reportSchema, 404: errorSchema, 503: errorSchema },
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

  /**
   * The whole of a child's history, raw, in one call - what the parent's report
   * screen folds for itself.
   *
   * Five reads used to happen in the same process as the render. Over the wire
   * that is five round trips before a parent sees anything, so it is one, the
   * trade `/play/state` makes for the child's screen.
   *
   * **Raw rather than the computed report next door.** Every chart on that
   * screen takes the observations and folds them itself - the bars, the
   * calendar, the tiles - and `/progress/lab` exists precisely to try foldings
   * that are not on the report yet. Serving the conclusions would leave both
   * with nothing to work from. `/children/:id/report` stays the endpoint for a
   * client that wants the conclusions and cannot compute them.
   *
   * **Null is not empty, and which of these may be null differs.** A failed
   * observations or sittings read is the whole screen's failure, so it is a 503
   * - drawing a database hiccup as "your child has never practised" is the lie
   * the null convention exists to prevent. The other three are passed through as
   * null: the report is still worth reading without its examples, and the
   * calendar falls back to plain shading rather than four weeks of missed goals.
   */
  app.get('/children/:id/record', {
    schema: {
      params: z.object({ id: z.string() }),
      querystring: z.object({
        subject: z.string().default('maths'),
        // Answers *per topic*, not a row cap - the report unfolds
        // `EXAMPLE_ANSWERS` of each and the lab asks for fifty, because a
        // pattern across a child's answers cannot show in three.
        perTopic: z.coerce.number().int().min(1).max(50).default(EXAMPLE_ANSWERS),
        // A duration, not an instant: the server keeps the clock, exactly as
        // `/play/state` decides its own `TARGET_WINDOW_MS`.
        windowMs: z.coerce.number().int().min(1).max(CALENDAR_WINDOW_MS).default(CALENDAR_WINDOW_MS),
        // A speed run has no curriculum topic, so only the subject that draws
        // them asks for them - an English report would be paying for a query
        // nothing renders.
        speedRuns: z.enum(['true', 'false']).default('false'),
      }),
      response: { 200: childHistorySchema, 404: errorSchema, 503: errorSchema },
    },
  }, async (request, reply) => {
    const parentId = await requireParent(request);
    const { id } = request.params;
    const { subject, perTopic, windowMs, speedRuns } = request.query;

    if (!(await mayRead(parentId, id))) return reply.code(404).send({ error: 'No such child' });

    const [observations, sittings, answers, recentAnswers, runs] = await Promise.all([
      readObservations(id, subject),
      readSittings(id, subject),
      readAnsweredQuestions(id, subject, perTopic),
      // Cross-subject, both of them: the calendar measures the child's whole
      // day against their goal, and a speed run has no subject to be scoped by.
      readRecentAnswers(id, Date.now() - windowMs),
      speedRuns === 'true' ? readSpeedSummaries(id) : Promise.resolve(null),
    ]);

    if (observations === null || sittings === null) {
      return reply.code(503).send({ error: 'Could not read the record' });
    }

    return reply.send({ observations, sittings, answers, recentAnswers, speedRuns: runs });
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
      response: { 200: z.array(answeredQuestionSchema), 404: errorSchema, 503: errorSchema },
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
