import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { startDatabase, stopDatabase, truncateAll } from '../helpers/db.js';
import { makeChild, makeParent } from '../helpers/factories.js';
import { buildServer } from '../../src/server.js';
import { issueLoginCode } from '../../src/data/accounts.js';

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
