import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { startDatabase, stopDatabase, truncateAll, testPrisma } from '../helpers/db.js';
import { makeParent } from '../helpers/factories.js';
import { resolveUserId } from '../../src/auth/session.js';

beforeAll(startDatabase);
afterAll(stopDatabase);
beforeEach(truncateAll);

async function aSessionToken(userId: string, expires: Date): Promise<string> {
  const token = randomUUID();
  await testPrisma().session.create({ data: { sessionToken: token, userId, expires } });
  return token;
}

describe('resolveUserId', () => {
  it('resolves a live session to its user', async () => {
    const userId = await makeParent();
    const token = await aSessionToken(userId, new Date(Date.now() + 60_000));

    expect(await resolveUserId(token)).toBe(userId);
  });

  it('refuses an expired session', async () => {
    const userId = await makeParent();
    const token = await aSessionToken(userId, new Date(Date.now() - 60_000));

    expect(await resolveUserId(token)).toBeNull();
  });

  it('refuses a token nobody issued', async () => {
    expect(await resolveUserId(randomUUID())).toBeNull();
  });

  it('refuses no token at all', async () => {
    expect(await resolveUserId(undefined)).toBeNull();
  });
});
