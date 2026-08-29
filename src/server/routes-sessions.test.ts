import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { startDatabase, stopDatabase, truncateAll, testPrisma } from './test-helpers/db';
import { makeChild, makeParent } from './test-helpers/factories';
import { SESSION_COOKIE_NAME } from '@/session-cookie';
import { POST as postAttempts } from '@/app/api/v1/sessions/[id]/attempts/route';
import { POST as postStartSession } from '@/app/api/v1/sessions/route';
import { POST as postAwardRound } from '@/app/api/v1/sessions/[id]/award-round/route';
import { POST as postAwardTarget } from '@/app/api/v1/sessions/[id]/award-target/route';
import { POST as postEndSession } from '@/app/api/v1/sessions/[id]/end/route';

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

/** A request against a path under `/api/v1`, with an optional session cookie and body. */
const asRequest = (path: string, token: string | null, body?: unknown) =>
  new Request(`https://learnr.test/api/v1${path}`, {
    method: 'POST',
    headers: {
      ...(token ? { cookie: `${SESSION_COOKIE_NAME}=${token}` } : {}),
      ...(body === undefined ? {} : { 'content-type': 'application/json' }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });

const params = (id: string) => ({ params: Promise.resolve({ id }) });

describe('POST /api/v1/sessions/:id/attempts', () => {
  it('records an answer and reports whether the streak advanced', async () => {
    const parentId = await makeParent();
    const childId = await makeChild(parentId);
    const token = await signIn(childId);
    const sittingId = await aSitting(childId);

    const response = await postAttempts(
      asRequest(`/sessions/${sittingId}/attempts`, token, { attempts: [anAttempt(true)] }),
      params(sittingId),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ streak: 1, streakAdvanced: true });
  });

  it('answers 401 to a request with no live session', async () => {
    const response = await postAttempts(
      asRequest('/sessions/whatever/attempts', null, { attempts: [] }),
      params('whatever'),
    );
    expect(response.status).toBe(401);
  });

  it('answers 404 for a sitting belonging to somebody else', async () => {
    const parentId = await makeParent();
    const mine = await makeChild(parentId, { name: 'Ada' });
    const theirs = await makeChild(parentId, { name: 'Grace' });
    const token = await signIn(mine);
    const sittingId = await aSitting(theirs);

    const response = await postAttempts(
      asRequest(`/sessions/${sittingId}/attempts`, token, { attempts: [anAttempt(true)] }),
      params(sittingId),
    );
    expect(response.status).toBe(404);
  });
});

describe('POST /api/v1/sessions', () => {
  it('answers 401 to a request with no live session', async () => {
    const response = await postStartSession(
      asRequest('/sessions', null, { id: randomUUID(), subject: 'maths', level: '3', seed: 'seed' }),
    );
    expect(response.status).toBe(401);
  });
});

describe('POST /api/v1/sessions/:id/award-round', () => {
  it('answers 401 to a request with no live session', async () => {
    const response = await postAwardRound(asRequest('/sessions/whatever/award-round', null), params('whatever'));
    expect(response.status).toBe(401);
  });

  it('answers 404 for a sitting belonging to somebody else', async () => {
    const parentId = await makeParent();
    const mine = await makeChild(parentId, { name: 'Ada' });
    const theirs = await makeChild(parentId, { name: 'Grace' });
    const token = await signIn(mine);
    const sittingId = await aSitting(theirs);

    const response = await postAwardRound(
      asRequest(`/sessions/${sittingId}/award-round`, token),
      params(sittingId),
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ stars: null });
  });
});

describe('POST /api/v1/sessions/:id/award-target', () => {
  it('answers 401 to a request with no live session', async () => {
    const response = await postAwardTarget(
      asRequest('/sessions/whatever/award-target', null, { offsetMinutes: 600 }),
      params('whatever'),
    );
    expect(response.status).toBe(401);
  });

  it('declines to award a sitting belonging to somebody else', async () => {
    const parentId = await makeParent();
    const mine = await makeChild(parentId, { name: 'Ada' });
    const theirs = await makeChild(parentId, { name: 'Grace' });
    const token = await signIn(mine);
    const sittingId = await aSitting(theirs);

    const response = await postAwardTarget(
      asRequest(`/sessions/${sittingId}/award-target`, token, { offsetMinutes: 600 }),
      params(sittingId),
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ awarded: false });
  });
});

describe('POST /api/v1/sessions/:id/end', () => {
  it('answers 401 to a request with no live session', async () => {
    const response = await postEndSession(asRequest('/sessions/whatever/end', null), params('whatever'));
    expect(response.status).toBe(401);
  });

  it('does not end a sitting belonging to somebody else', async () => {
    const parentId = await makeParent();
    const mine = await makeChild(parentId, { name: 'Ada' });
    const theirs = await makeChild(parentId, { name: 'Grace' });
    const token = await signIn(mine);
    const sittingId = await aSitting(theirs);

    const response = await postEndSession(asRequest(`/sessions/${sittingId}/end`, token), params(sittingId));
    expect(response.status).toBe(204);

    const sitting = await testPrisma().learningSession.findUniqueOrThrow({ where: { id: sittingId } });
    expect(sitting.endedAt).toBeNull();
  });
});
