import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { startDatabase, stopDatabase, truncateAll, testPrisma } from '../helpers/db.js';
import { makeChild, makeParent } from '../helpers/factories.js';
import { buildServer } from '../../src/server.js';
import { recordAttempt, recordSessionStart } from '../../src/data/records.js';
import { submitSpeedRun } from '../../src/data/speed-records.js';

let app: FastifyInstance;

beforeAll(async () => {
  await startDatabase();
  app = buildServer();
  await app.ready();
});

afterAll(async () => {
  await app.close();
  await stopDatabase();
});

beforeEach(truncateAll);

async function signIn(userId: string): Promise<string> {
  const token = randomUUID();
  await testPrisma().session.create({
    data: { sessionToken: token, userId, expires: new Date(Date.now() + 60_000) },
  });
  return token;
}

const as = (token: string) => ({ authorization: `Bearer ${token}` });

async function play(
  childId: string,
  count: number,
  overrides: { topic?: string; correct?: boolean } = {},
): Promise<void> {
  const sessionId = (await recordSessionStart({
    userId: childId,
    subject: 'maths',
    level: '3',
    seed: 's',
  }))!;

  for (let i = 0; i < count; i++) {
    await recordAttempt(childId, sessionId, {
      id: randomUUID(),
      templateId: 'maths.3.addition.sum',
      subject: 'maths',
      topic: overrides.topic ?? 'addition',
      level: '3',
      prompt: 'What is 2 + 2?',
      expected: '4',
      response: overrides.correct === false ? '5' : '4',
      correct: overrides.correct ?? true,
      timeTakenMs: 1000,
      answeredAt: Date.now() + i,
      offsetMinutes: 600,
    });
  }
}

/**
 * The parent's report used to make five reads against Prisma in the same
 * process - observations, sittings, the examples per topic, a month of answers
 * for the calendar and the child's speed runs. Over the wire that is five round
 * trips before a parent sees anything, so it is one call, the same trade
 * `/play/state` makes for the child's screen.
 *
 * It answers with the *raw* history rather than the computed report next door:
 * every chart on that screen folds the observations itself, and `/progress/lab`
 * exists precisely to try foldings that are not on the report yet.
 */
describe('GET /children/:id/record', () => {
  it('refuses a caller who is not signed in', async () => {
    const childId = await makeChild(await makeParent());

    const response = await app.inject({ method: 'GET', url: `/children/${childId}/record` });

    expect(response.statusCode).toBe(401);
  });

  it('refuses a child this parent cannot see', async () => {
    const mine = await makeParent();
    const theirs = await makeParent();
    const theirChild = await makeChild(theirs);

    const response = await app.inject({
      method: 'GET',
      url: `/children/${theirChild}/record`,
      headers: as(await signIn(mine)),
    });

    expect(response.statusCode).toBe(404);
  });

  it('is empty rather than absent for a child who has never played', async () => {
    const parentId = await makeParent();
    const childId = await makeChild(parentId);

    const response = await app.inject({
      method: 'GET',
      url: `/children/${childId}/record?subject=maths`,
      headers: as(await signIn(parentId)),
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      observations: [],
      sittings: [],
      answers: [],
      recentAnswers: [],
    });
  });

  it('carries the whole history the report folds', async () => {
    const parentId = await makeParent();
    const childId = await makeChild(parentId);
    await play(childId, 3);

    const response = await app.inject({
      method: 'GET',
      url: `/children/${childId}/record?subject=maths`,
      headers: as(await signIn(parentId)),
    });

    const body = response.json();
    expect(body.observations).toHaveLength(3);
    expect(body.observations[0].topic).toBe('addition');
    expect(body.sittings).toHaveLength(1);
    expect(body.answers).toHaveLength(3);
    // The calendar's read is cross-subject and scoped by a window, not a topic.
    expect(body.recentAnswers).toHaveLength(3);
  });

  /**
   * The examples are per *topic*, not a row cap - three of each is what the
   * report unfolds under "needs a hand", and the lab asks for fifty because a
   * pattern across answers cannot show in three.
   */
  it('takes the examples per topic from the caller', async () => {
    const parentId = await makeParent();
    const childId = await makeChild(parentId);
    await play(childId, 5);
    const token = await signIn(parentId);

    const few = await app.inject({
      method: 'GET',
      url: `/children/${childId}/record?subject=maths`,
      headers: as(token),
    });
    expect(few.json().answers).toHaveLength(3);

    const many = await app.inject({
      method: 'GET',
      url: `/children/${childId}/record?subject=maths&perTopic=50`,
      headers: as(token),
    });
    expect(many.json().answers).toHaveLength(5);
  });

  /**
   * A speed run has no curriculum topic, so it is asked for only by the screen
   * that draws it - an English report would be paying for a query nothing
   * renders.
   */
  it('fetches the speed runs only when asked for them', async () => {
    const parentId = await makeParent();
    const childId = await makeChild(parentId);
    await submitSpeedRun(childId, { id: randomUUID(), mode: { op: 'multiply', tables: 7 }, correct: 12, playedAt: new Date() });
    const token = await signIn(parentId);

    const without = await app.inject({
      method: 'GET',
      url: `/children/${childId}/record?subject=english`,
      headers: as(token),
    });
    expect(without.json().speedRuns).toBeNull();

    const withRuns = await app.inject({
      method: 'GET',
      url: `/children/${childId}/record?subject=maths&speedRuns=true`,
      headers: as(token),
    });
    expect(withRuns.json().speedRuns).toHaveLength(1);
  });

  /**
   * The window is a duration rather than an instant: the server has the clock,
   * exactly as `/play/state` decides its own `TARGET_WINDOW_MS`.
   */
  it('bounds the calendar read by the window it is given', async () => {
    const parentId = await makeParent();
    const childId = await makeChild(parentId);
    await play(childId, 2);
    const token = await signIn(parentId);

    const wide = await app.inject({
      method: 'GET',
      url: `/children/${childId}/record?subject=maths&windowMs=${29 * 24 * 60 * 60 * 1000}`,
      headers: as(token),
    });
    expect(wide.json().recentAnswers).toHaveLength(2);

    // A window of one millisecond can only reach answers given in the last
    // millisecond, which is none of them.
    const narrow = await app.inject({
      method: 'GET',
      url: `/children/${childId}/record?subject=maths&windowMs=1`,
      headers: as(token),
    });
    expect(narrow.json().recentAnswers).toEqual([]);
  });
});
