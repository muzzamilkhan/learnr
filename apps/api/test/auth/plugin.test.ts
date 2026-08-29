import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import { startDatabase, stopDatabase, truncateAll, testPrisma } from '../helpers/db.js';
import { makeChild, makeParent } from '../helpers/factories.js';
import { authPlugin, requireParent, requireUser } from '../../src/auth/plugin.js';

beforeAll(startDatabase);
afterAll(stopDatabase);
beforeEach(truncateAll);

/**
 * The plugin is the only thing standing between a request and someone else's
 * child, so it is worth driving directly rather than only through the routes
 * that will sit on top of it.
 */
async function anApp(): Promise<FastifyInstance> {
  const app = Fastify();
  await app.register(authPlugin);
  app.get('/who', async (request) => ({ userId: request.userId }));
  app.get('/mine', async (request) => ({ userId: requireUser(request) }));
  app.get('/parents-only', async (request) => ({ userId: await requireParent(request) }));
  return app;
}

async function aSessionToken(userId: string, expires = new Date(Date.now() + 60_000)) {
  const token = randomUUID();
  await testPrisma().session.create({ data: { sessionToken: token, userId, expires } });
  return token;
}

describe('the token a request carries', () => {
  it('is read from an Authorization: Bearer header', async () => {
    const app = await anApp();
    const userId = await makeParent();
    const token = await aSessionToken(userId);

    const response = await app.inject({
      method: 'GET', url: '/who', headers: { authorization: `Bearer ${token}` },
    });

    expect(response.json()).toEqual({ userId });
    await app.close();
  });

  it('is read from the Auth.js session cookie', async () => {
    const app = await anApp();
    const userId = await makeParent();
    const token = await aSessionToken(userId);

    const response = await app.inject({
      method: 'GET', url: '/who', headers: { cookie: `authjs.session-token=${token}` },
    });

    expect(response.json()).toEqual({ userId });
    await app.close();
  });

  // The cookie header is a list, and the session cookie is rarely first.
  it('is found among other cookies', async () => {
    const app = await anApp();
    const userId = await makeParent();
    const token = await aSessionToken(userId);

    const response = await app.inject({
      method: 'GET',
      url: '/who',
      headers: { cookie: `theme=dark; authjs.session-token=${token}; other=1` },
    });

    expect(response.json()).toEqual({ userId });
    await app.close();
  });

  /**
   * Two cookies, one name. This is not hypothetical - it took child sign-in
   * down in production on 2026-08-29.
   *
   * The session cookie used to be host-only. Scoping it to
   * `Domain=learnr.muzza.tech`, so the browser would send it to the API's
   * subdomain, does **not** replace the host-only one a browser is already
   * holding: a `Set-Cookie` carrying a `Domain` writes a *second* cookie of the
   * same name, and the browser then sends both. Signing in again does not help,
   * because signing in is the very thing that writes the second one.
   *
   * Which of the two wins was then decided by whichever parser read the header.
   * Auth.js saw a live session and let the page render; this plugin returned on
   * the first match, got the stale one, and answered 401 to every call the page
   * then made. So a token is tried until one resolves, rather than the first
   * being treated as the only one there is.
   */
  it('tries every cookie of that name, so a stale one cannot mask a live one', async () => {
    const app = await anApp();
    const userId = await makeParent();
    const stale = randomUUID();
    const live = await aSessionToken(userId);

    const response = await app.inject({
      method: 'GET',
      url: '/who',
      headers: { cookie: `authjs.session-token=${stale}; authjs.session-token=${live}` },
    });

    expect(response.json()).toEqual({ userId });
    await app.close();
  });

  // The same, the other way round: whichever order the browser sends them in.
  it('finds the live one when it comes first', async () => {
    const app = await anApp();
    const userId = await makeParent();
    const live = await aSessionToken(userId);

    const response = await app.inject({
      method: 'GET',
      url: '/who',
      headers: { cookie: `authjs.session-token=${live}; authjs.session-token=${randomUUID()}` },
    });

    expect(response.json()).toEqual({ userId });
    await app.close();
  });

  // An expired session is not a live one, so it must not be the answer just
  // because it parsed - the second cookie is still worth trying.
  it('passes over an expired session for a live one', async () => {
    const app = await anApp();
    const userId = await makeParent();
    const expired = await aSessionToken(userId, new Date(Date.now() - 60_000));
    const live = await aSessionToken(userId);

    const response = await app.inject({
      method: 'GET',
      url: '/who',
      headers: { cookie: `authjs.session-token=${expired}; authjs.session-token=${live}` },
    });

    expect(response.json()).toEqual({ userId });
    await app.close();
  });

  it('is nobody when the request carries nothing', async () => {
    const app = await anApp();

    const response = await app.inject({ method: 'GET', url: '/who' });

    expect(response.json()).toEqual({ userId: null });
    await app.close();
  });

  it('is nobody when the session has expired', async () => {
    const app = await anApp();
    const userId = await makeParent();
    const token = await aSessionToken(userId, new Date(Date.now() - 60_000));

    const response = await app.inject({
      method: 'GET', url: '/who', headers: { authorization: `Bearer ${token}` },
    });

    expect(response.json()).toEqual({ userId: null });
    await app.close();
  });
});

describe('requireUser', () => {
  it('lets a signed-in user through', async () => {
    const app = await anApp();
    const userId = await makeParent();
    const token = await aSessionToken(userId);

    const response = await app.inject({
      method: 'GET', url: '/mine', headers: { authorization: `Bearer ${token}` },
    });

    expect(response.statusCode).toBe(200);
    await app.close();
  });

  it('answers 401 when there is nobody', async () => {
    const app = await anApp();

    const response = await app.inject({ method: 'GET', url: '/mine' });

    expect(response.statusCode).toBe(401);
    await app.close();
  });
});

describe('requireParent', () => {
  it('lets a parent through', async () => {
    const app = await anApp();
    const parentId = await makeParent();
    const token = await aSessionToken(parentId);

    const response = await app.inject({
      method: 'GET', url: '/parents-only', headers: { authorization: `Bearer ${token}` },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ userId: parentId });
    await app.close();
  });

  // A child reaching a parent screen is signed in, just not allowed - 403,
  // never 401, which would send them off to sign in again.
  it('answers 403 for a child, not 401', async () => {
    const app = await anApp();
    const childId = await makeChild(await makeParent());
    const token = await aSessionToken(childId);

    const response = await app.inject({
      method: 'GET', url: '/parents-only', headers: { authorization: `Bearer ${token}` },
    });

    expect(response.statusCode).toBe(403);
    await app.close();
  });

  it('answers 401 when there is nobody at all', async () => {
    const app = await anApp();

    const response = await app.inject({ method: 'GET', url: '/parents-only' });

    expect(response.statusCode).toBe(401);
    await app.close();
  });
});
