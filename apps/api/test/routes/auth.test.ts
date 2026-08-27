import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { startDatabase, stopDatabase, truncateAll } from '../helpers/db.js';
import { makeChild, makeParent } from '../helpers/factories.js';
import { buildServer } from '../../src/server.js';
import { issueLoginCode } from '../../src/data/accounts.js';
import { REDEEM_BACKSTOP_LIMIT } from '@learnr/core/login-code';

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

describe('POST /auth/redeem', () => {
  it('trades a live code for a token', async () => {
    const parentId = await makeParent();
    const childId = await makeChild(parentId);
    const code = await issueLoginCode(parentId, childId);

    const response = await app.inject({
      method: 'POST', url: '/auth/redeem', payload: { code },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ childId });
    expect(response.json().token).toBeTypeOf('string');
  });

  it('refuses a code that has already been spent', async () => {
    const parentId = await makeParent();
    const childId = await makeChild(parentId);
    const code = await issueLoginCode(parentId, childId);

    await app.inject({ method: 'POST', url: '/auth/redeem', payload: { code } });
    const second = await app.inject({ method: 'POST', url: '/auth/redeem', payload: { code } });

    expect(second.statusCode).toBe(401);
  });

  it('refuses a code nobody issued', async () => {
    const response = await app.inject({
      method: 'POST', url: '/auth/redeem', payload: { code: 'ZZZZ' },
    });

    expect(response.statusCode).toBe(401);
  });
});

describe('GET /me', () => {
  it('needs a token', async () => {
    const response = await app.inject({ method: 'GET', url: '/me' });
    expect(response.statusCode).toBe(401);
  });

  it('answers with the account the token belongs to', async () => {
    const parentId = await makeParent();
    const childId = await makeChild(parentId);
    const code = await issueLoginCode(parentId, childId);

    const redeemed = await app.inject({
      method: 'POST', url: '/auth/redeem', payload: { code },
    });
    const { token } = redeemed.json();

    const response = await app.inject({
      method: 'GET', url: '/me', headers: { authorization: `Bearer ${token}` },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ id: childId, role: 'child' });
  });
});

/**
 * The code is the credential and the endpoint is deliberately open, so the only
 * thing between a guesser and a child's account is the size of the guess space:
 * 31^4 is 923,521, `redeemLoginCode` matches *any* live code rather than one
 * child's, and the session it hands back does not expire.
 *
 * This limit is the **backstop**, not the primary control. A web-app request
 * reaches here from Vercel, so every browser-typed code shares one key - which
 * is why the number is generous and why the tight per-browser limit lives in
 * the web app's own action, where the child's real IP is visible.
 */
describe('POST /auth/redeem is throttled', () => {
  const guess = (ip: string) =>
    app.inject({
      method: 'POST',
      url: '/auth/redeem',
      headers: { 'fly-client-ip': ip },
      payload: { code: 'ZZZZ' },
    });

  it('refuses a caller that has spent its failures', async () => {
    for (let i = 0; i < REDEEM_BACKSTOP_LIMIT; i += 1) {
      expect((await guess('198.51.100.1')).statusCode).toBe(401);
    }

    const refused = await guess('198.51.100.1');

    expect(refused.statusCode).toBe(429);
    expect(refused.headers['retry-after']).toBeDefined();
  });

  it('counts each caller separately', async () => {
    for (let i = 0; i < REDEEM_BACKSTOP_LIMIT; i += 1) await guess('198.51.100.2');

    expect((await guess('198.51.100.3')).statusCode).toBe(401);
  });

  it('forgets a caller that redeems a real code', async () => {
    const parentId = await makeParent();
    const childId = await makeChild(parentId);
    const code = await issueLoginCode(parentId, childId);

    for (let i = 0; i < REDEEM_BACKSTOP_LIMIT - 1; i += 1) await guess('198.51.100.4');

    const redeemed = await app.inject({
      method: 'POST',
      url: '/auth/redeem',
      headers: { 'fly-client-ip': '198.51.100.4' },
      payload: { code },
    });
    expect(redeemed.statusCode).toBe(200);

    // The slate is clean, so the next wrong guess is an ordinary 401 rather
    // than the one that would have tipped it over.
    expect((await guess('198.51.100.4')).statusCode).toBe(401);
  });
});
