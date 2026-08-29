import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { startDatabase, stopDatabase, truncateAll, testPrisma } from './test-helpers/db';
import { makeChild, makeParent } from './test-helpers/factories';
import { readChildRecord } from './reports';
import { recordAttempt, recordSessionStart } from './records';
import { acceptShareInvite, createShareInvite } from './sharing';
import { submitSpeedRun } from './speed-records';
import { parseMode } from '@/lib/speedrun/modes';

beforeAll(startDatabase);
afterAll(stopDatabase);
beforeEach(truncateAll);

async function play(childId: string, count: number): Promise<void> {
  const sessionId = (await recordSessionStart({
    userId: childId, subject: 'maths', level: '3', seed: 's',
  }))!;
  for (let i = 0; i < count; i++) {
    await recordAttempt(childId, sessionId, {
      id: randomUUID(), templateId: 'maths.3.addition.sum', subject: 'maths', topic: 'addition',
      level: '3', prompt: 'What is 2 + 2?', expected: '4', response: '4', correct: true,
      timeTakenMs: 1000, answeredAt: Date.now() + i, offsetMinutes: 600,
    });
  }
}

/**
 * The report screen's whole read. It used to be `GET /children/:id/record`, and
 * what the endpoint had to do - resolve the child against what this parent may
 * see, then fold five reads into one answer - is what this composes.
 */
describe('readChildRecord', () => {
  it('answers for a child this parent owns', async () => {
    const parentId = await makeParent();
    const childId = await makeChild(parentId);
    await play(childId, 3);

    const record = await readChildRecord(parentId, childId, { subject: 'maths' });

    expect(record?.observations).toHaveLength(3);
    expect(record?.sittings).toHaveLength(1);
    expect(record?.answers).not.toBeNull();
  });

  // The whole of the authorization: `readViewableChildren` is what every parent
  // screen resolves `?child=` against, and there is no second check to drift.
  it('refuses a child this parent cannot see', async () => {
    const mine = await makeParent();
    const theirs = await makeParent();
    const theirChild = await makeChild(theirs);
    await play(theirChild, 3);

    expect(await readChildRecord(mine, theirChild, { subject: 'maths' })).toBeNull();
  });

  it('answers for a child shared with them, which is what makes a shared report open', async () => {
    const owner = await makeParent();
    const childId = await makeChild(owner, { name: 'Shared' });
    const viewer = await makeParent();
    await play(childId, 2);

    const invite = (await createShareInvite(owner, [childId]))!;
    await acceptShareInvite(invite.token, viewer);

    const record = await readChildRecord(viewer, childId, { subject: 'maths' });
    expect(record?.observations).toHaveLength(2);
  });

  // `[]` is a child who has never practised and `null` is a read that broke.
  // The screen says something different for each, so this must be the empty one.
  it('answers with empty history for a child who has never played, not null', async () => {
    const parentId = await makeParent();
    const childId = await makeChild(parentId);

    const record = await readChildRecord(parentId, childId, { subject: 'maths' });

    expect(record).not.toBeNull();
    expect(record?.observations).toEqual([]);
    expect(record?.sittings).toEqual([]);
    expect(record?.answers).toEqual([]);
  });

  /**
   * A speed run has no curriculum topic, so only the subject that draws them
   * asks for them - an English report would be paying for a query nothing
   * renders.
   */
  it('reads the speed runs only when they are asked for', async () => {
    const parentId = await makeParent();
    const childId = await makeChild(parentId);
    await submitSpeedRun(childId, {
      id: randomUUID(), mode: parseMode('multiply.7')!, correct: 12, playedAt: new Date(),
    });

    const without = await readChildRecord(parentId, childId, { subject: 'maths' });
    expect(without?.speedRuns).toBeNull();

    const withRuns = await readChildRecord(parentId, childId, {
      subject: 'maths', speedRuns: true,
    });
    expect(withRuns?.speedRuns).toHaveLength(1);
  });

  // Answers *per topic*, not a row cap: the report unfolds three of each and the
  // lab asks for fifty, because a pattern across a child's answers cannot show
  // in three.
  it('takes the answer count per topic', async () => {
    const parentId = await makeParent();
    const childId = await makeChild(parentId);
    await play(childId, 5);

    const few = await readChildRecord(parentId, childId, { subject: 'maths', perTopic: 2 });
    const many = await readChildRecord(parentId, childId, { subject: 'maths', perTopic: 50 });

    expect(few?.answers).toHaveLength(2);
    expect(many?.answers).toHaveLength(5);
  });

  // The calendar's window is a duration this side turns into an instant, so an
  // answer older than it is outside the calendar and inside the observations.
  it('bounds the calendar window without bounding the history', async () => {
    const parentId = await makeParent();
    const childId = await makeChild(parentId);
    await play(childId, 1);

    const old = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);
    await testPrisma().attempt.updateMany({ data: { answeredAt: old } });

    const record = await readChildRecord(parentId, childId, { subject: 'maths' });

    expect(record?.observations).toHaveLength(1);
    expect(record?.recentAnswers).toEqual([]);
  });
});
