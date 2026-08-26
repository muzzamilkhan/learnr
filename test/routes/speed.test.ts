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

const as = (token: string) => ({ authorization: `Bearer ${token}` });

describe('GET /speed/modes', () => {
  // The mode list is static content, the same for everyone, so it needs no
  // session - a child must be able to see what to play before signing in.
  it('lists the modes, each with the key the client submits', async () => {
    const response = await app.inject({ method: 'GET', url: '/speed/modes' });

    expect(response.statusCode).toBe(200);
    const modes = response.json();
    expect(modes.length).toBeGreaterThan(0);
    for (const mode of modes) expect(mode.key).toBeTypeOf('string');
  });
});

describe('POST /speed/runs', () => {
  it('refuses a caller who is not signed in', async () => {
    const response = await app.inject({
      method: 'POST', url: '/speed/runs',
      payload: { id: randomUUID(), mode: 'multiply.7', correct: 12 },
    });

    expect(response.statusCode).toBe(401);
  });

  it('records a run and reports the personal best', async () => {
    const childId = await makeChild(await makeParent());
    const headers = as(await signIn(childId));

    const first = await app.inject({
      method: 'POST', url: '/speed/runs', headers,
      payload: { id: randomUUID(), mode: 'multiply.7', correct: 12 },
    });
    expect(first.statusCode).toBe(200);
    expect(first.json()).toMatchObject({ previousBest: null, best: 12, isRecord: false });

    const better = await app.inject({
      method: 'POST', url: '/speed/runs', headers,
      payload: { id: randomUUID(), mode: 'multiply.7', correct: 20 },
    });
    expect(better.json()).toMatchObject({ previousBest: 12, best: 20, isRecord: true });
  });

  it('refuses a mode that does not exist', async () => {
    const childId = await makeChild(await makeParent());

    const response = await app.inject({
      method: 'POST', url: '/speed/runs', headers: as(await signIn(childId)),
      payload: { id: randomUUID(), mode: 'divide.by.zero', correct: 3 },
    });

    expect(response.statusCode).toBe(400);
    expect(await testPrisma().speedAttempt.count()).toBe(0);
  });
});

describe('GET /speed/records', () => {
  it('answers with the runs behind the records', async () => {
    const childId = await makeChild(await makeParent());
    const headers = as(await signIn(childId));

    await app.inject({
      method: 'POST', url: '/speed/runs', headers,
      payload: { id: randomUUID(), mode: 'multiply.7', correct: 12 },
    });

    const response = await app.inject({ method: 'GET', url: '/speed/records', headers });

    expect(response.statusCode).toBe(200);
    expect(response.json().attempts).toHaveLength(1);
  });
});

describe('GET /speed/unseen', () => {
  it('refuses a child asking - it is the parent-s notification', async () => {
    const childId = await makeChild(await makeParent());

    const response = await app.inject({
      method: 'GET', url: '/speed/unseen', headers: as(await signIn(childId)),
    });

    expect(response.statusCode).toBe(403);
  });

  it('is empty for a parent whose children have set no records', async () => {
    const parentId = await makeParent();

    const response = await app.inject({
      method: 'GET', url: '/speed/unseen', headers: as(await signIn(parentId)),
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual([]);
  });
});
