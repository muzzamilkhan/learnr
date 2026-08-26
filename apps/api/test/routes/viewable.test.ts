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

/**
 * GET /children is a parent's *own* children. Every parent screen reads the
 * viewable list instead - own plus shared - and serving the owned list there
 * would silently drop a shared child from the dashboard with nothing to show
 * for it. That is the whole reason this route exists separately.
 */
describe('GET /children/viewable', () => {
  it('refuses a child asking', async () => {
    const childId = await makeChild(await makeParent());

    const response = await app.inject({
      method: 'GET', url: '/children/viewable', headers: as(await signIn(childId)),
    });

    expect(response.statusCode).toBe(403);
  });

  it('lists a parent-s own children', async () => {
    const parentId = await makeParent();
    await makeChild(parentId, { name: 'Mine' });

    const response = await app.inject({
      method: 'GET', url: '/children/viewable', headers: as(await signIn(parentId)),
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().map((c: { name: string }) => c.name)).toEqual(['Mine']);
  });

  it('includes a child shared with them, which GET /children does not', async () => {
    const owner = await makeParent();
    const shared = await makeChild(owner, { name: 'Shared' });
    const viewer = await makeParent();
    await makeChild(viewer, { name: 'Own' });

    const ownerAuth = as(await signIn(owner));
    const viewerAuth = as(await signIn(viewer));

    const invite = await app.inject({
      method: 'POST', url: '/shares', headers: ownerAuth, payload: { childIds: [shared] },
    });
    await app.inject({
      method: 'POST', url: `/shares/${invite.json().token}/accept`, headers: viewerAuth,
    });

    const owned = await app.inject({ method: 'GET', url: '/children', headers: viewerAuth });
    const viewable = await app.inject({
      method: 'GET', url: '/children/viewable', headers: viewerAuth,
    });

    expect(owned.json().map((c: { name: string }) => c.name)).toEqual(['Own']);
    expect(viewable.json().map((c: { name: string }) => c.name).sort()).toEqual(['Own', 'Shared']);
  });

  // The same invariant sharing.ts guards: a viewer holding the code could sign
  // in as the child.
  it('never carries a shared child-s login code', async () => {
    const owner = await makeParent();
    const shared = await makeChild(owner);
    const viewer = await makeParent();
    const ownerAuth = as(await signIn(owner));
    const viewerAuth = as(await signIn(viewer));

    await app.inject({ method: 'POST', url: `/children/${shared}/login-code`, headers: ownerAuth });
    const invite = await app.inject({
      method: 'POST', url: '/shares', headers: ownerAuth, payload: { childIds: [shared] },
    });
    await app.inject({
      method: 'POST', url: `/shares/${invite.json().token}/accept`, headers: viewerAuth,
    });

    const viewable = await app.inject({
      method: 'GET', url: '/children/viewable', headers: viewerAuth,
    });

    expect(viewable.json()[0].code).toBeNull();
    expect(viewable.json()[0].codeExpiresAt).toBeNull();
  });
});

describe('GET /shares/:token', () => {
  it('describes a live link so the page can ask "accept this?"', async () => {
    const owner = await makeParent();
    const childId = await makeChild(owner, { name: 'Ada' });
    const ownerAuth = as(await signIn(owner));

    const invite = await app.inject({
      method: 'POST', url: '/shares', headers: ownerAuth, payload: { childIds: [childId] },
    });
    const { token } = invite.json();

    const viewer = await makeParent();
    const response = await app.inject({
      method: 'GET', url: `/shares/${token}`, headers: as(await signIn(viewer)),
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.live).toBe(true);
    expect(body.ownerId).toBe(owner);
    expect(body.children.map((c: { name: string }) => c.name)).toEqual(['Ada']);
  });

  it('answers 404 for a token nobody issued', async () => {
    const viewer = await makeParent();

    const response = await app.inject({
      method: 'GET', url: `/shares/${randomUUID()}`, headers: as(await signIn(viewer)),
    });

    expect(response.statusCode).toBe(404);
  });
});

describe('GET /speed/summaries', () => {
  it('is empty for a child who has run nothing', async () => {
    const childId = await makeChild(await makeParent());

    const response = await app.inject({
      method: 'GET', url: '/speed/summaries', headers: as(await signIn(childId)),
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual([]);
  });

  it('summarises a run once one exists', async () => {
    const childId = await makeChild(await makeParent());
    const headers = as(await signIn(childId));

    await app.inject({
      method: 'POST', url: '/speed/runs', headers,
      payload: { id: randomUUID(), mode: 'multiply.7', correct: 12 },
    });

    const response = await app.inject({ method: 'GET', url: '/speed/summaries', headers });

    expect(response.json().length).toBeGreaterThan(0);
  });
});
