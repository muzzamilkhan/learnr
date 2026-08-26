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

describe('GET /children', () => {
  it('refuses a child asking', async () => {
    const parentId = await makeParent();
    const childId = await makeChild(parentId);
    const token = await signIn(childId);

    const response = await app.inject({
      method: 'GET', url: '/children', headers: { authorization: `Bearer ${token}` },
    });

    expect(response.statusCode).toBe(403);
  });

  it('lists this parent-s children and nobody else-s', async () => {
    const mine = await makeParent();
    const theirs = await makeParent();
    await makeChild(mine, { name: 'Mine' });
    await makeChild(theirs, { name: 'Theirs' });
    const token = await signIn(mine);

    const response = await app.inject({
      method: 'GET', url: '/children', headers: { authorization: `Bearer ${token}` },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().map((c: { name: string }) => c.name)).toEqual(['Mine']);
  });
});

describe('POST /children', () => {
  it('adds a child, mapping the wire shape onto the stored one', async () => {
    const parentId = await makeParent();
    const token = await signIn(parentId);

    const response = await app.inject({
      method: 'POST',
      url: '/children',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        name: 'Ada', avatar: 'fox', level: '3',
        targetKind: 'questions', targetValue: 10, photo: null,
      },
    });

    expect(response.statusCode).toBe(201);

    const stored = await testPrisma().user.findUnique({ where: { id: response.json().id } });
    expect(stored).toMatchObject({
      name: 'Ada', avatar: 'fox', selectedLevel: '3',
      targetKind: 'questions', targetValue: 10, parentId,
    });
  });

  // The wire says "avatar" as a string; only parseAvatar decides whether it is
  // one. An unknown name is a bad request, not a child with a broken face.
  it('refuses an avatar that does not exist', async () => {
    const parentId = await makeParent();
    const token = await signIn(parentId);

    const response = await app.inject({
      method: 'POST',
      url: '/children',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        name: 'Ada', avatar: 'tyrannosaurus', level: '3',
        targetKind: null, targetValue: null, photo: null,
      },
    });

    expect(response.statusCode).toBe(400);
    expect(await testPrisma().user.count({ where: { parentId } })).toBe(0);
  });

  // TARGET_LIMITS floors a questions target at ten. Half a target, or one below
  // the floor, is a bad request rather than a child with a goal they cannot see.
  it('refuses a target below what a parent could have set', async () => {
    const parentId = await makeParent();
    const token = await signIn(parentId);

    const response = await app.inject({
      method: 'POST',
      url: '/children',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        name: 'Ada', avatar: 'fox', level: '3',
        targetKind: 'questions', targetValue: 5, photo: null,
      },
    });

    expect(response.statusCode).toBe(400);
  });
});

describe('POST /children/:id/login-code', () => {
  it('issues a code for a child this parent owns', async () => {
    const parentId = await makeParent();
    const childId = await makeChild(parentId);
    const token = await signIn(parentId);

    const response = await app.inject({
      method: 'POST',
      url: `/children/${childId}/login-code`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().code).toMatch(/^[A-Z2-9]{4}$/);
  });

  // The expiry reported must be the one stored, not an hour guessed at by the
  // route - a child staring at a code that has already gone is the failure.
  it('reports the expiry the code was actually minted with', async () => {
    const parentId = await makeParent();
    const childId = await makeChild(parentId);
    const token = await signIn(parentId);

    const response = await app.inject({
      method: 'POST',
      url: `/children/${childId}/login-code`,
      headers: { authorization: `Bearer ${token}` },
    });

    const stored = await testPrisma().user.findUnique({
      where: { id: childId },
      select: { loginCodeExpiresAt: true },
    });

    expect(response.json().expiresAt).toBe(stored?.loginCodeExpiresAt?.toISOString());
  });

  it('refuses a child another parent owns', async () => {
    const mine = await makeParent();
    const theirs = await makeParent();
    const theirChild = await makeChild(theirs);
    const token = await signIn(mine);

    const response = await app.inject({
      method: 'POST',
      url: `/children/${theirChild}/login-code`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(response.statusCode).toBe(404);
  });
});

describe('DELETE /children/:id', () => {
  it('refuses to delete a child another parent owns', async () => {
    const mine = await makeParent();
    const theirs = await makeParent();
    const theirChild = await makeChild(theirs);
    const token = await signIn(mine);

    const response = await app.inject({
      method: 'DELETE',
      url: `/children/${theirChild}`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(response.statusCode).toBe(404);
    expect(await testPrisma().user.findUnique({ where: { id: theirChild } })).not.toBeNull();
  });
});
