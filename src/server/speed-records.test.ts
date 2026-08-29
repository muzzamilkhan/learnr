import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { startDatabase, stopDatabase, truncateAll, testPrisma } from './test-helpers/db';
import { makeChild, makeParent } from './test-helpers/factories';
import {
  dismissSpeedRecords,
  readSpeedAttempts,
  readSpeedScores,
  readSpeedSummaries,
  readUnseenRecords,
  submitSpeedRun,
} from './speed-records';
import { parseMode } from '@/lib/speedrun/modes';

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

const aRun = (userId: string, correct: number) =>
  submitSpeedRun(userId, { id: randomUUID(), mode: MODE, correct, playedAt: new Date() });

/**
 * Both walls of the scores screen, from one read.
 *
 * **The board ranks a household, which is not the caller.** A parent's household
 * is their own id and a child's is their *parent's*, so ranking a child by their
 * own id would put them on a board of one - silently, on every child's screen.
 */
describe('readSpeedScores', () => {
  it('answers with the runs behind the records', async () => {
    const childId = await makeChild(await makeParent());
    await aRun(childId, 12);

    expect((await readSpeedScores(childId))?.attempts).toHaveLength(1);
  });

  it('ranks a child against the rest of their household', async () => {
    const parentId = await makeParent({ name: 'Grown-up' });
    const childId = await makeChild(parentId, { name: 'Ada' });
    const sibling = await makeChild(parentId, { name: 'Bo' });

    await aRun(childId, 12);
    await aRun(sibling, 20);
    await aRun(parentId, 30);

    const family = (await readSpeedScores(childId))?.family;

    expect(family).toHaveLength(3);
    expect(family?.map((row) => row.playerName).sort()).toEqual(['Ada', 'Bo', 'Grown-up']);
  });

  /**
   * A child on their own Google account belongs to no household. That is not a
   * failed read and not an empty board - it is nobody to rank - so `family` is
   * null while the answer itself is not, and the screen tells the two apart.
   */
  it('answers a null family for a player who has no household', async () => {
    const orphan = await testPrisma().user.create({ data: { name: 'Alone', role: 'child' } });

    const scores = await readSpeedScores(orphan.id);

    expect(scores).not.toBeNull();
    expect(scores?.family).toBeNull();
    expect(scores?.attempts).toEqual([]);
  });
});

describe('readSpeedSummaries', () => {
  it('is empty for a child who has run nothing', async () => {
    expect(await readSpeedSummaries(await makeChild(await makeParent()))).toEqual([]);
  });

  it('summarises a mode once a run exists', async () => {
    const childId = await makeChild(await makeParent());
    await aRun(childId, 12);

    expect(await readSpeedSummaries(childId)).toHaveLength(1);
  });
});

/**
 * The banner reports somebody else's achievement and never your own, which is
 * why this is scoped to a parent's *children*. Dismissing it is scoped the same
 * way: the child id arrives from the browser.
 */
describe('the unseen-record banner', () => {
  it('is empty for a parent whose children have set no records', async () => {
    expect(await readUnseenRecords(await makeParent())).toEqual([]);
  });

  it('carries a record a child of theirs beat, and goes once dismissed', async () => {
    const parentId = await makeParent();
    const childId = await makeChild(parentId, { name: 'Ada' });

    await aRun(childId, 12);
    await aRun(childId, 20);

    expect(await readUnseenRecords(parentId)).toHaveLength(1);

    await dismissSpeedRecords(parentId, childId);
    expect(await readUnseenRecords(parentId)).toEqual([]);
  });

  it('shows one parent nothing about another parent-s child', async () => {
    const owner = await makeParent();
    const childId = await makeChild(owner);
    const stranger = await makeParent();

    await aRun(childId, 12);
    await aRun(childId, 20);

    expect(await readUnseenRecords(stranger)).toEqual([]);

    // And a stranger naming the child id cannot mark it seen either.
    await dismissSpeedRecords(stranger, childId);
    expect(await readUnseenRecords(owner)).toHaveLength(1);
  });
});
