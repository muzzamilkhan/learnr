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

describe('GET /speed/modes', () => {
  // The mode list is static content, the same for everyone, so it needs no
  // session - a child must be able to see what to play before signing in.
  it('lists the modes, each with the key the client submits', async () => {
    const response = await app.inject({ method: 'GET', url: '/speed/modes' });

    expect(response.statusCode).toBe(200);
    const modes = response.json();
    expect(modes.length).toBeGreaterThan(0);
    for (const mode of modes) expect(mode.key).toBeTypeOf('string');
  });
});

describe('POST /speed/runs', () => {
  it('refuses a caller who is not signed in', async () => {
    const response = await app.inject({
      method: 'POST', url: '/speed/runs',
      payload: { id: randomUUID(), mode: 'multiply.7', correct: 12 },
    });

    expect(response.statusCode).toBe(401);
  });

  it('records a run and reports the personal best', async () => {
    const childId = await makeChild(await makeParent());
    const headers = as(await signIn(childId));

    const first = await app.inject({
      method: 'POST', url: '/speed/runs', headers,
      payload: { id: randomUUID(), mode: 'multiply.7', correct: 12 },
    });
    expect(first.statusCode).toBe(200);
    expect(first.json()).toMatchObject({ previousBest: null, best: 12, isRecord: false });

    const better = await app.inject({
      method: 'POST', url: '/speed/runs', headers,
      payload: { id: randomUUID(), mode: 'multiply.7', correct: 20 },
    });
    expect(better.json()).toMatchObject({ previousBest: 12, best: 20, isRecord: true });
  });

  /**
   * A run played offline belongs to when it was played, not to when the queue
   * finally drained: `playedAt` orders the cabinet, the report table and the
   * family board, and tie-breaks which run gets starred.
   */
  describe('the played-at stamp', () => {
    const submit = (headers: Record<string, string>, payload: Record<string, unknown>) =>
      app.inject({ method: 'POST', url: '/speed/runs', headers, payload });

    it('stores the stamp a late flush carries', async () => {
      const childId = await makeChild(await makeParent());
      const played = new Date(Date.now() - 9 * 60 * 60 * 1000);

      await submit(as(await signIn(childId)), {
        id: randomUUID(), mode: 'multiply.7', correct: 12, playedAt: played.toISOString(),
      });

      const [attempt] = await testPrisma().speedAttempt.findMany();
      expect(attempt.playedAt.toISOString()).toBe(played.toISOString());
    });

    // A run that set a best was achieved when it was played, so the star the
    // cabinet draws off `achievedAt` follows the stamp too.
    it('dates the record it sets by the same stamp', async () => {
      const childId = await makeChild(await makeParent());
      const played = new Date(Date.now() - 9 * 60 * 60 * 1000);

      await submit(as(await signIn(childId)), {
        id: randomUUID(), mode: 'multiply.7', correct: 12, playedAt: played.toISOString(),
      });

      const [record] = await testPrisma().speedRecord.findMany();
      expect(record.achievedAt.toISOString()).toBe(played.toISOString());
    });

    it('falls back to the server clock when no stamp is sent', async () => {
      const childId = await makeChild(await makeParent());
      const before = Date.now();

      const response = await submit(as(await signIn(childId)), {
        id: randomUUID(), mode: 'multiply.7', correct: 12,
      });

      expect(response.statusCode).toBe(200);
      const [attempt] = await testPrisma().speedAttempt.findMany();
      expect(attempt.playedAt.getTime()).toBeGreaterThanOrEqual(before);
    });

    // The run is kept and only its stamp is given up - a refused stamp must
    // never cost a child the run itself.
    it('keeps the run but not a stamp in the future', async () => {
      const childId = await makeChild(await makeParent());
      const before = Date.now();

      const response = await submit(as(await signIn(childId)), {
        id: randomUUID(), mode: 'multiply.7', correct: 12,
        playedAt: '2099-01-01T00:00:00.000Z',
      });

      expect(response.statusCode).toBe(200);
      const [attempt] = await testPrisma().speedAttempt.findMany();
      expect(attempt.correct).toBe(12);
      expect(attempt.playedAt.getTime()).toBeGreaterThanOrEqual(before);
    });

    it('refuses a stamp that is not a full timestamp, without losing the run', async () => {
      const childId = await makeChild(await makeParent());

      const response = await submit(as(await signIn(childId)), {
        id: randomUUID(), mode: 'multiply.7', correct: 12, playedAt: '2026-08-28',
      });

      expect(response.statusCode).toBe(200);
      expect(await testPrisma().speedAttempt.count()).toBe(1);
    });
  });

  it('refuses a mode that does not exist', async () => {
    const childId = await makeChild(await makeParent());

    const response = await app.inject({
      method: 'POST', url: '/speed/runs', headers: as(await signIn(childId)),
      payload: { id: randomUUID(), mode: 'divide.by.zero', correct: 3 },
    });

    expect(response.statusCode).toBe(400);
    expect(await testPrisma().speedAttempt.count()).toBe(0);
  });
});

describe('GET /speed/records', () => {
  it('answers with the runs behind the records', async () => {
    const childId = await makeChild(await makeParent());
    const headers = as(await signIn(childId));

    await app.inject({
      method: 'POST', url: '/speed/runs', headers,
      payload: { id: randomUUID(), mode: 'multiply.7', correct: 12 },
    });

    const response = await app.inject({ method: 'GET', url: '/speed/records', headers });

    expect(response.statusCode).toBe(200);
    expect(response.json().attempts).toHaveLength(1);
  });
});

describe('GET /speed/unseen', () => {
  it('refuses a child asking - it is the parent-s notification', async () => {
    const childId = await makeChild(await makeParent());

    const response = await app.inject({
      method: 'GET', url: '/speed/unseen', headers: as(await signIn(childId)),
    });

    expect(response.statusCode).toBe(403);
  });

  it('is empty for a parent whose children have set no records', async () => {
    const parentId = await makeParent();

    const response = await app.inject({
      method: 'GET', url: '/speed/unseen', headers: as(await signIn(parentId)),
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual([]);
  });
});

/**
 * A leaderboard ranks a *household*, and who that is depends on who is asking:
 * a parent's household is their own id, a child's is their parent's. Ranking a
 * child against `userId` would have put them on a board of one - a family of
 * one is not a family, and the screen says so rather than drawing it.
 */
describe('GET /speed/records, whose family', () => {
  it('ranks a child against the rest of their household', async () => {
    const parentId = await makeParent({ name: 'Grown-up' });
    const childId = await makeChild(parentId, { name: 'Ada' });
    const sibling = await makeChild(parentId, { name: 'Bo' });

    for (const [userId, correct] of [[childId, 12], [sibling, 20], [parentId, 30]] as const) {
      await app.inject({
        method: 'POST', url: '/speed/runs', headers: as(await signIn(userId)),
        payload: { id: randomUUID(), mode: 'multiply.7', correct },
      });
    }

    const response = await app.inject({
      method: 'GET', url: '/speed/records', headers: as(await signIn(childId)),
    });

    expect(response.statusCode).toBe(200);
    const family = response.json().family;
    expect(family).toHaveLength(3);
    expect(family.map((row: { playerName: string }) => row.playerName).sort())
      .toEqual(['Ada', 'Bo', 'Grown-up']);
  });

  /**
   * A child on their own Google account belongs to no household. That is not a
   * failed read and not an empty board - it is nobody to rank - so it is null
   * beside a 200, and the 503 stays reserved for a read that actually broke.
   */
  it('answers null for a player who has no household', async () => {
    const orphan = await testPrisma().user.create({ data: { name: 'Alone', role: 'child' } });

    const response = await app.inject({
      method: 'GET', url: '/speed/records', headers: as(await signIn(orphan.id)),
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().family).toBeNull();
    expect(response.json().attempts).toEqual([]);
  });
});
