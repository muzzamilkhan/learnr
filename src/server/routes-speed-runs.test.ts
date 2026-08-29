import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { startDatabase, stopDatabase, truncateAll, testPrisma } from './test-helpers/db';
import { makeChild, makeParent } from './test-helpers/factories';
import { SESSION_COOKIE_NAME } from '@/session-cookie';
import { POST } from '@/app/api/v1/speed/runs/route';

beforeAll(startDatabase);
afterAll(stopDatabase);
beforeEach(truncateAll);

async function signIn(userId: string): Promise<string> {
  const token = randomUUID();
  await testPrisma().session.create({
    data: { sessionToken: token, userId, expires: new Date(Date.now() + 60_000) },
  });
  return token;
}

const asRequest = (token: string | null, body: unknown) =>
  new Request('https://learnr.test/api/v1/speed/runs', {
    method: 'POST',
    headers: {
      ...(token ? { cookie: `${SESSION_COOKIE_NAME}=${token}` } : {}),
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  });

describe('POST /api/v1/speed/runs', () => {
  it('answers 401 to a request with no live session', async () => {
    const response = await POST(asRequest(null, { id: randomUUID(), mode: 'add.easy', correct: 5 }));
    expect(response.status).toBe(401);
  });

  it('banks the run against the calling user - no sitting id to misuse here', async () => {
    const childId = await makeChild(await makeParent());
    const token = await signIn(childId);

    const response = await POST(
      asRequest(token, { id: randomUUID(), mode: 'add.easy', correct: 7 }),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ previousBest: null, best: 7, isRecord: false });

    const record = await testPrisma().speedRecord.findFirst({ where: { mode: 'add.easy' } });
    expect(record).toMatchObject({ userId: childId, mode: 'add.easy', best: 7 });
  });
});
