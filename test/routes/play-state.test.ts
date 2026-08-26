import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { startDatabase, stopDatabase, truncateAll, testPrisma } from '../helpers/db.js';
import { makeChild, makeParent } from '../helpers/factories.js';
import { buildServer } from '../../src/server.js';
import { recordAttempt, recordSessionStart } from '../../src/data/records.js';

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

async function play(childId: string, count: number): Promise<void> {
  const sessionId = (await recordSessionStart({
    userId: childId, subject: 'maths', level: '3', seed: 's',
  }))!;
  for (let i = 0; i < count; i++) {
    await recordAttempt(childId, sessionId, {
      id: randomUUID(), templateId: 't', subject: 'maths', topic: 'addition',
      level: '3', prompt: 'p', expected: '4', response: '4', correct: true,
      timeTakenMs: 1000, answeredAt: Date.now() + i, offsetMinutes: 600,
    });
  }
}

/**
 * The play screen used to make five reads against Prisma. Over the wire that
 * would be five round trips before the first question renders, so it is one
 * endpoint returning the whole shape the screen needs.
 */
describe('GET /play/state', () => {
  it('refuses a caller who is not signed in', async () => {
    const response = await app.inject({ method: 'GET', url: '/play/state?subject=maths&level=3' });
    expect(response.statusCode).toBe(401);
  });

  it('answers with an empty profile for a child who has never played', async () => {
    const childId = await makeChild(await makeParent());

    const response = await app.inject({
      method: 'GET', url: '/play/state?subject=maths&level=3', headers: as(await signIn(childId)),
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.profile.skills).toEqual([]);
    expect(body.recentTopics).toEqual([]);
    expect(body.player.stars).toBe(0);
    expect(body.player.selectedLevel).toBe('3');
  });

  it('returns the profile, topics and player state a sitting needs', async () => {
    const childId = await makeChild(await makeParent());
    await play(childId, 3);

    const response = await app.inject({
      method: 'GET', url: '/play/state?subject=maths&level=3', headers: as(await signIn(childId)),
    });

    const body = response.json();
    expect(body.profile.skills.find((s: { topic: string }) => s.topic === 'addition')).toBeTruthy();
    expect(body.recentTopics).toContain('addition');
    expect(body.player.streak).toBeTruthy();
  });

  // The page fetched a window of answers only when the child had a goal to
  // measure them against. That conditional moves here rather than costing a
  // round trip the caller then throws away.
  it('carries a window of answers only for a child with a target', async () => {
    const childId = await makeChild(await makeParent());
    await play(childId, 3);
    const token = await signIn(childId);

    const without = await app.inject({
      method: 'GET', url: '/play/state?subject=maths&level=3', headers: as(token),
    });
    expect(without.json().targetAnswers).toEqual([]);

    await testPrisma().user.update({
      where: { id: childId },
      data: { targetKind: 'questions', targetValue: 10 },
    });

    const withTarget = await app.inject({
      method: 'GET', url: '/play/state?subject=maths&level=3', headers: as(token),
    });
    expect(withTarget.json().targetAnswers).toHaveLength(3);
  });
});

describe('PUT /me/level', () => {
  it('stores the level the child chose', async () => {
    const childId = await makeChild(await makeParent(), { level: '2' });

    const response = await app.inject({
      method: 'PUT', url: '/me/level',
      headers: as(await signIn(childId)), payload: { level: '5' },
    });

    expect(response.statusCode).toBe(204);
    const stored = await testPrisma().user.findUnique({ where: { id: childId } });
    expect(stored?.selectedLevel).toBe('5');
  });

  it('refuses a level that is not a school year', async () => {
    const childId = await makeChild(await makeParent(), { level: '2' });

    const response = await app.inject({
      method: 'PUT', url: '/me/level',
      headers: as(await signIn(childId)), payload: { level: '99' },
    });

    expect(response.statusCode).toBe(400);
    const stored = await testPrisma().user.findUnique({ where: { id: childId } });
    expect(stored?.selectedLevel).toBe('2');
  });
});

describe('POST /me/claim-parent', () => {
  it('claims the role for an account that has none', async () => {
    const user = await testPrisma().user.create({ data: { name: 'New' } });

    const response = await app.inject({
      method: 'POST', url: '/me/claim-parent', headers: as(await signIn(user.id)),
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ claimed: true });
  });

  it('does not overwrite a role that is already set', async () => {
    const parentId = await makeParent();

    const response = await app.inject({
      method: 'POST', url: '/me/claim-parent', headers: as(await signIn(parentId)),
    });

    expect(response.json()).toEqual({ claimed: false });
  });

  // The guard exists so a stray sign-in cannot promote a managed child.
  it('will not promote a managed child', async () => {
    const childId = await makeChild(await makeParent());

    const response = await app.inject({
      method: 'POST', url: '/me/claim-parent', headers: as(await signIn(childId)),
    });

    expect(response.json()).toEqual({ claimed: false });
    const stored = await testPrisma().user.findUnique({ where: { id: childId } });
    expect(stored?.role).toBe('child');
  });
});
