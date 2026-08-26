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

describe('GET /shares', () => {
  it('refuses a child asking', async () => {
    const childId = await makeChild(await makeParent());
    const response = await app.inject({
      method: 'GET', url: '/shares', headers: as(await signIn(childId)),
    });

    expect(response.statusCode).toBe(403);
  });

  it('starts empty for a parent who has shared nothing', async () => {
    const parentId = await makeParent();
    const response = await app.inject({
      method: 'GET', url: '/shares', headers: as(await signIn(parentId)),
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ invites: [], viewers: [] });
  });
});

describe('a share, end to end over the wire', () => {
  it('is created, accepted once, and revoked', async () => {
    const owner = await makeParent();
    const childId = await makeChild(owner, { name: 'Shared' });
    const viewer = await makeParent();
    const other = await makeParent();

    const ownerAuth = as(await signIn(owner));
    const viewerAuth = as(await signIn(viewer));

    const created = await app.inject({
      method: 'POST', url: '/shares', headers: ownerAuth, payload: { childIds: [childId] },
    });
    expect(created.statusCode).toBe(201);
    const { token } = created.json();

    const accepted = await app.inject({
      method: 'POST', url: `/shares/${token}/accept`, headers: viewerAuth,
    });
    expect(accepted.statusCode).toBe(200);
    expect(accepted.json().ok).toBe(true);

    // One link admits one person.
    const again = await app.inject({
      method: 'POST', url: `/shares/${token}/accept`, headers: as(await signIn(other)),
    });
    expect(again.json().ok).toBe(false);

    const viewers = await app.inject({ method: 'GET', url: '/shares', headers: ownerAuth });
    expect(viewers.json().viewers).toHaveLength(1);

    const revoked = await app.inject({
      method: 'DELETE', url: `/shares/viewers/${viewer}`, headers: ownerAuth,
    });
    expect(revoked.statusCode).toBe(204);

    const after = await app.inject({ method: 'GET', url: '/shares', headers: ownerAuth });
    expect(after.json().viewers).toEqual([]);
  });

  it('cannot be cancelled by a parent who does not own it', async () => {
    const owner = await makeParent();
    const childId = await makeChild(owner);
    const stranger = await makeParent();

    const created = await app.inject({
      method: 'POST', url: '/shares', headers: as(await signIn(owner)),
      payload: { childIds: [childId] },
    });

    const invites = await app.inject({
      method: 'GET', url: '/shares', headers: as(await signIn(owner)),
    });
    const inviteId = invites.json().invites[0]?.id;
    expect(inviteId).toBeTypeOf('string');
    expect(created.statusCode).toBe(201);

    const response = await app.inject({
      method: 'DELETE', url: `/shares/${inviteId}`, headers: as(await signIn(stranger)),
    });

    expect(response.statusCode).toBe(404);
  });
});

/**
 * The page behind a link is public, and has to be: the whole point of the link
 * is that it reaches somebody who has no account here yet. They see who is
 * offering and which children, decide, and *then* sign in - so this read cannot
 * be behind the session that following the link is meant to produce.
 *
 * It stays read-only either way. Following your own link to check it must not
 * spend it, which is what keeps this safe to serve to anybody holding a token.
 */
describe('GET /shares/:token, signed out', () => {
  it('describes what a link is offering, with no session at all', async () => {
    const owner = await makeParent({ name: 'Sam' });
    const childId = await makeChild(owner, { name: 'Shared' });

    const created = await app.inject({
      method: 'POST', url: '/shares', headers: as(await signIn(owner)),
      payload: { childIds: [childId] },
    });
    const { token } = created.json();

    const response = await app.inject({ method: 'GET', url: `/shares/${token}` });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ live: true, ownerName: 'Sam' });
    expect(response.json().children[0]).toMatchObject({ name: 'Shared' });
  });

  it('still answers 404 for a token that is not a link', async () => {
    const response = await app.inject({ method: 'GET', url: '/shares/not-a-token' });

    expect(response.statusCode).toBe(404);
  });
});
