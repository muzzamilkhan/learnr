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

describe('GET /children/:id/report', () => {
  it('answers for a child this parent owns', async () => {
    const parentId = await makeParent();
    const childId = await makeChild(parentId);
    const token = await signIn(parentId);

    const response = await app.inject({
      method: 'GET',
      url: `/children/${childId}/report?subject=maths`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toHaveProperty('topics');
  });

  it('refuses a child this parent cannot see', async () => {
    const mine = await makeParent();
    const theirs = await makeParent();
    const theirChild = await makeChild(theirs);
    const token = await signIn(mine);

    const response = await app.inject({
      method: 'GET',
      url: `/children/${theirChild}/report`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(response.statusCode).toBe(404);
  });
});
