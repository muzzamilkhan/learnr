import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { startDatabase, stopDatabase, truncateAll, testPrisma } from '../helpers/db.js';
import { makeChild, makeParent } from '../helpers/factories.js';
import { readSpeedAttempts, submitSpeedRun } from '../../src/data/speed-records.js';
import { parseMode } from '@learnr/core/speedrun/modes';

beforeAll(startDatabase);
afterAll(stopDatabase);
beforeEach(truncateAll);

const MODE = parseMode('multiply.7')!;

describe('submitSpeedRun', () => {
  it('records the first run as a personal best without announcing a record', async () => {
    const childId = await makeChild(await makeParent());

    const outcome = await submitSpeedRun(childId, { id: randomUUID(), mode: MODE, correct: 12, playedAt: new Date() });

    expect(outcome).toMatchObject({ previousBest: null, best: 12, isRecord: false });
  });

  it('announces a genuine improvement', async () => {
    const childId = await makeChild(await makeParent());

    await submitSpeedRun(childId, { id: randomUUID(), mode: MODE, correct: 12, playedAt: new Date() });
    const outcome = await submitSpeedRun(childId, { id: randomUUID(), mode: MODE, correct: 20, playedAt: new Date() });

    expect(outcome).toMatchObject({ previousBest: 12, best: 20, isRecord: true });
  });

  it('keeps the best when a later run is worse, but still keeps the run', async () => {
    const childId = await makeChild(await makeParent());

    await submitSpeedRun(childId, { id: randomUUID(), mode: MODE, correct: 20, playedAt: new Date() });
    const outcome = await submitSpeedRun(childId, { id: randomUUID(), mode: MODE, correct: 8, playedAt: new Date() });

    expect(outcome).toMatchObject({ best: 20, isRecord: false });

    const attempts = await readSpeedAttempts(childId);
    expect(attempts).toHaveLength(2);
  });

  it('writes one run when a flush is retried, because the id is the run', async () => {
    const childId = await makeChild(await makeParent());
    const id = randomUUID();
    // Held across the flush, like the id and for the same reason: both belong
    // to the run rather than to the request that carried it.
    const playedAt = new Date();

    // The shape a sync queue produces: the first flush landed, its response was
    // lost, and the queue sent the same run again.
    await submitSpeedRun(childId, { id, mode: MODE, correct: 15, playedAt });
    await submitSpeedRun(childId, { id, mode: MODE, correct: 15, playedAt });

    expect(await readSpeedAttempts(childId)).toHaveLength(1);
  });

  it('keeps two runs that happened to score the same, because they are two runs', async () => {
    const childId = await makeChild(await makeParent());

    await submitSpeedRun(childId, { id: randomUUID(), mode: MODE, correct: 15, playedAt: new Date() });
    await submitSpeedRun(childId, { id: randomUUID(), mode: MODE, correct: 15, playedAt: new Date() });

    expect(await readSpeedAttempts(childId)).toHaveLength(2);
  });

  it('is idempotent under a race, because a record is a maximum', async () => {
    const childId = await makeChild(await makeParent());

    await Promise.all([
      submitSpeedRun(childId, { id: randomUUID(), mode: MODE, correct: 15, playedAt: new Date() }),
      submitSpeedRun(childId, { id: randomUUID(), mode: MODE, correct: 15, playedAt: new Date() }),
    ]);

    const records = await testPrisma().speedRecord.findMany({ where: { userId: childId } });
    expect(records).toHaveLength(1);
    expect(records[0]?.best).toBe(15);
  });
});
