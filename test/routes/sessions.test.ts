import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { startDatabase, stopDatabase, truncateAll, testPrisma } from '../helpers/db.js';
import { makeChild, makeParent } from '../helpers/factories.js';
import { buildServer } from '../../src/server.js';

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

function anAttempt(index: number, correct: boolean) {
  return {
    id: randomUUID(),
    templateId: 'maths.3.addition.sum',
    subject: 'maths',
    topic: 'addition',
    level: '3' as const,
    prompt: 'What is 2 + 2?',
    expected: '4',
    response: correct ? '4' : '5',
    correct,
    timeTakenMs: 1000,
    answeredAt: Date.now() + index * 1000,
    offsetMinutes: 600,
  };
}

describe('POST /sessions', () => {
  it('refuses a caller who is not signed in', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/sessions',
      payload: { id: randomUUID(), subject: 'maths', level: '3', seed: 's' },
    });

    expect(response.statusCode).toBe(401);
  });

  it('opens a sitting at the id the client chose', async () => {
    const childId = await makeChild(await makeParent());
    const token = await signIn(childId);
    const id = randomUUID();

    const response = await app.inject({
      method: 'POST',
      url: '/sessions',
      headers: { authorization: `Bearer ${token}` },
      payload: { id, subject: 'maths', level: '3', seed: 's' },
    });

    expect(response.statusCode).toBe(201);
    expect(response.json()).toEqual({ id });
  });

  it('is idempotent, so a retried flush does not open a second sitting', async () => {
    const childId = await makeChild(await makeParent());
    const token = await signIn(childId);
    const id = randomUUID();
    const payload = { id, subject: 'maths', level: '3', seed: 's' };

    const first = await app.inject({
      method: 'POST', url: '/sessions',
      headers: { authorization: `Bearer ${token}` }, payload,
    });
    const second = await app.inject({
      method: 'POST', url: '/sessions',
      headers: { authorization: `Bearer ${token}` }, payload,
    });

    expect(first.statusCode).toBe(201);
    expect(second.statusCode).toBe(200);
    expect(await testPrisma().learningSession.count()).toBe(1);
  });
});

describe('POST /sessions/:id/attempts', () => {
  it('records a batch, as an offline flush sends it', async () => {
    const childId = await makeChild(await makeParent());
    const token = await signIn(childId);
    const id = randomUUID();

    await app.inject({
      method: 'POST', url: '/sessions',
      headers: { authorization: `Bearer ${token}` },
      payload: { id, subject: 'maths', level: '3', seed: 's' },
    });

    const response = await app.inject({
      method: 'POST',
      url: `/sessions/${id}/attempts`,
      headers: { authorization: `Bearer ${token}` },
      payload: { attempts: [anAttempt(0, true), anAttempt(1, true)] },
    });

    expect(response.statusCode).toBe(200);
    expect(await testPrisma().attempt.count()).toBe(2);
  });

  it('does not double-count a replayed batch', async () => {
    const childId = await makeChild(await makeParent());
    const token = await signIn(childId);
    const id = randomUUID();

    await app.inject({
      method: 'POST', url: '/sessions',
      headers: { authorization: `Bearer ${token}` },
      payload: { id, subject: 'maths', level: '3', seed: 's' },
    });

    const batch = { attempts: [anAttempt(0, true), anAttempt(1, true)] };
    const headers = { authorization: `Bearer ${token}` };

    const first = await app.inject({ method: 'POST', url: `/sessions/${id}/attempts`, headers, payload: batch });
    const second = await app.inject({ method: 'POST', url: `/sessions/${id}/attempts`, headers, payload: batch });

    // The replay must *succeed*. Checking the counts alone is not enough: with
    // the dedupe guard removed the duplicate insert raises a unique violation,
    // recordAttempt swallows it and returns null, and the route answers 404 -
    // so the counts stay right while the client is told its sitting is gone.
    expect(first.statusCode).toBe(200);
    expect(second.statusCode).toBe(200);

    expect(await testPrisma().attempt.count()).toBe(2);

    const skill = await testPrisma().topicSkill.findFirst({ where: { userId: childId } });
    expect(skill?.attempts).toBe(2);
  });

  it('refuses a sitting belonging to someone else', async () => {
    const parentId = await makeParent();
    const mine = await makeChild(parentId);
    const theirs = await makeChild(parentId);
    const myToken = await signIn(mine);
    const theirToken = await signIn(theirs);
    const id = randomUUID();

    await app.inject({
      method: 'POST', url: '/sessions',
      headers: { authorization: `Bearer ${theirToken}` },
      payload: { id, subject: 'maths', level: '3', seed: 's' },
    });

    const response = await app.inject({
      method: 'POST',
      url: `/sessions/${id}/attempts`,
      headers: { authorization: `Bearer ${myToken}` },
      payload: { attempts: [anAttempt(0, true)] },
    });

    expect(response.statusCode).toBe(404);
    expect(await testPrisma().attempt.count()).toBe(0);
  });
});

// `figure` crosses the wire as unknown, so the route runs it through
// parseFigure - the same boundary normaliser the recording action uses, whose
// own documentation warns about hand-rolled writes reaching it.
describe('the figure on an attempt', () => {
  const A_FIGURE = { width: 100, height: 50, marks: [] };

  it('is stored when it is well formed', async () => {
    const childId = await makeChild(await makeParent());
    const token = await signIn(childId);
    const id = randomUUID();
    const headers = { authorization: `Bearer ${token}` };

    await app.inject({
      method: 'POST', url: '/sessions', headers,
      payload: { id, subject: 'maths', level: '3', seed: 's' },
    });

    const response = await app.inject({
      method: 'POST', url: `/sessions/${id}/attempts`, headers,
      payload: { attempts: [{ ...anAttempt(0, true), figure: A_FIGURE }] },
    });

    expect(response.statusCode).toBe(200);
    const stored = await testPrisma().attempt.findFirst({ select: { figure: true } });
    expect(stored?.figure).toEqual(A_FIGURE);
  });

  // A malformed drawing must not cost the answer it arrived with.
  it('is dropped when it is malformed, and the answer still lands', async () => {
    const childId = await makeChild(await makeParent());
    const token = await signIn(childId);
    const id = randomUUID();
    const headers = { authorization: `Bearer ${token}` };

    await app.inject({
      method: 'POST', url: '/sessions', headers,
      payload: { id, subject: 'maths', level: '3', seed: 's' },
    });

    const response = await app.inject({
      method: 'POST', url: `/sessions/${id}/attempts`, headers,
      payload: { attempts: [{ ...anAttempt(0, true), figure: { nonsense: true } }] },
    });

    expect(response.statusCode).toBe(200);
    expect(await testPrisma().attempt.count()).toBe(1);

    const stored = await testPrisma().attempt.findFirst({ select: { figure: true } });
    expect(stored?.figure).toBeNull();
  });
});
