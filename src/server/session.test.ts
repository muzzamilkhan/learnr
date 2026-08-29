import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { startDatabase, stopDatabase, truncateAll, testPrisma } from './test-helpers/db';
import { makeParent } from './test-helpers/factories';
import { resolveUserId, userIdFrom } from './session';
import { SESSION_COOKIE_NAME } from '@/session-cookie';

beforeAll(startDatabase);
afterAll(stopDatabase);
beforeEach(truncateAll);

async function aSessionToken(userId: string, expires: Date): Promise<string> {
  const token = randomUUID();
  await testPrisma().session.create({ data: { sessionToken: token, userId, expires } });
  return token;
}

async function signIn(userId: string): Promise<string> {
  const token = randomUUID();
  await testPrisma().session.create({
    data: { sessionToken: token, userId, expires: new Date(Date.now() + 60_000) },
  });
  return token;
}

const withCookies = (value: string) =>
  new Request('https://learnr.test/api/v1/sessions', { headers: { cookie: value } });

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

describe('userIdFrom', () => {
  it('tries every session cookie, so a stale one cannot mask a live one', async () => {
    const parentId = await makeParent();
    const live = await signIn(parentId);

    // Two cookies of the same name: the browser sends both, oldest first. The
    // host-only one written before the Domain was added is the stale one, and
    // returning on the first match let it speak for the live one - every call
    // the page made became a 401. See ba5453f.
    const name = SESSION_COOKIE_NAME;
    expect(await userIdFrom(withCookies(`${name}=stale; ${name}=${live}`))).toBe(parentId);
  });

  it('answers null when no cookie resolves', async () => {
    await makeParent();
    expect(await userIdFrom(withCookies(`${SESSION_COOKIE_NAME}=nothing`))).toBeNull();
  });

  it('answers null when there is no cookie header at all', async () => {
    expect(await userIdFrom(new Request('https://learnr.test/api/v1/sessions'))).toBeNull();
  });
});
