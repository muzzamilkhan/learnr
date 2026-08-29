import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { startDatabase, stopDatabase, truncateAll, testPrisma } from './test-helpers/db';
import { makeChild, makeParent } from './test-helpers/factories';
import { SESSION_COOKIE_NAME } from '@/session-cookie';
import { POST } from '@/app/api/v1/sessions/[id]/attempts/route';

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

async function aSitting(userId: string): Promise<string> {
  const sitting = await testPrisma().learningSession.create({
    data: { userId, subject: 'maths', level: '3', seed: 'seed' },
  });
  return sitting.id;
}

const anAttempt = (correct: boolean) => ({
  id: randomUUID(),
  templateId: 'maths.3.addition.sum',
  subject: 'maths',
  topic: 'addition',
  level: '3' as const,
  prompt: 'What is 2 + 2?',
  expected: '4',
  response: correct ? '4' : '5',
  correct,
  timeTakenMs: 1000,
  answeredAt: Date.now(),
  offsetMinutes: 600,
});

const asRequest = (token: string, sittingId: string, body: unknown) =>
  new Request(`https://learnr.test/api/v1/sessions/${sittingId}/attempts`, {
    method: 'POST',
    headers: { cookie: `${SESSION_COOKIE_NAME}=${token}`, 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });

describe('POST /api/v1/sessions/:id/attempts', () => {
  it('records an answer and reports whether the streak advanced', async () => {
    const parentId = await makeParent();
    const childId = await makeChild(parentId);
    const token = await signIn(childId);
    const sittingId = await aSitting(childId);

    const response = await POST(
      asRequest(token, sittingId, { attempts: [anAttempt(true)] }),
      { params: Promise.resolve({ id: sittingId }) },
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ streak: 1, streakAdvanced: true });
  });

  it('answers 401 to a request with no live session', async () => {
    const response = await POST(
      asRequest('nothing', 'whatever', { attempts: [] }),
      { params: Promise.resolve({ id: 'whatever' }) },
    );
    expect(response.status).toBe(401);
  });

  it('answers 404 for a sitting belonging to somebody else', async () => {
    const parentId = await makeParent();
    const mine = await makeChild(parentId, { name: 'Ada' });
    const theirs = await makeChild(parentId, { name: 'Grace' });
    const token = await signIn(mine);
    const sittingId = await aSitting(theirs);

    const response = await POST(
      asRequest(token, sittingId, { attempts: [anAttempt(true)] }),
      { params: Promise.resolve({ id: sittingId }) },
    );
    expect(response.status).toBe(404);
  });
});
