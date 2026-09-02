import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { startDatabase, stopDatabase, truncateAll, testPrisma } from './test-helpers/db';
import { makeChild, makeParent } from './test-helpers/factories';
import {
  readLearnerProfile,
  readObservations,
  readSittings,
  recordAttempt,
  recordSessionStart,
} from './records';
import type { Attempt } from '@/lib/session/session';

beforeAll(startDatabase);
afterAll(stopDatabase);
beforeEach(truncateAll);

function anAttempt(overrides: Partial<Attempt> = {}): Attempt {
  return {
    templateId: 'maths.3.addition.sum',
    subject: 'maths',
    topic: 'addition',
    level: '3',
    prompt: 'What is 2 + 2?',
    expected: '4',
    response: '4',
    correct: true,
    timeTakenMs: 1500,
    answeredAt: Date.now(),
    offsetMinutes: 600,
    ...overrides,
  };
}

async function aSession(childId: string): Promise<string> {
  const id = await recordSessionStart({
    userId: childId,
    subject: 'maths',
    level: '3',
    seed: 'seed-1',
  });
  if (!id) throw new Error('the session did not start');
  return id;
}

describe('recordAttempt', () => {
  it('writes the attempt and folds it into the topic skill', async () => {
    const childId = await makeChild(await makeParent());
    const sessionId = await aSession(childId);

    const result = await recordAttempt(childId, sessionId, anAttempt());

    expect(result).not.toBeNull();
    expect(await testPrisma().attempt.count()).toBe(1);

    const skill = await testPrisma().topicSkill.findFirst({ where: { userId: childId } });
    expect(skill).toMatchObject({ topic: 'addition', level: '3', attempts: 1, correct: 1 });
  });

  it('refuses an attempt on a session belonging to someone else', async () => {
    const parentId = await makeParent();
    const mine = await makeChild(parentId);
    const theirs = await makeChild(parentId);
    const sessionId = await aSession(theirs);

    expect(await recordAttempt(mine, sessionId, anAttempt())).toBeNull();
    expect(await testPrisma().attempt.count()).toBe(0);
  });

  it('folds many answers onto one skill row rather than racing them away', async () => {
    const childId = await makeChild(await makeParent());
    const sessionId = await aSession(childId);

    // Answered at once, as two tabs or a fast child would.
    await Promise.all(
      Array.from({ length: 10 }, (_, i) =>
        recordAttempt(childId, sessionId, anAttempt({ answeredAt: Date.now() + i })),
      ),
    );

    const skills = await testPrisma().topicSkill.findMany({ where: { userId: childId } });
    expect(skills).toHaveLength(1);
    expect(skills[0]?.attempts).toBe(10);
  });
});

describe('readObservations', () => {
  it('returns [] for a child who has never played, not null', async () => {
    const childId = await makeChild(await makeParent());
    expect(await readObservations(childId, 'maths')).toEqual([]);
  });
});

describe('readLearnerProfile', () => {
  it('rebuilds the same profile the live fold produced', async () => {
    const childId = await makeChild(await makeParent());
    const sessionId = await aSession(childId);

    await recordAttempt(childId, sessionId, anAttempt({ correct: true }));
    await recordAttempt(childId, sessionId, anAttempt({ correct: false, response: '5' }));

    const profile = await readLearnerProfile(childId, 'maths');
    const skill = profile.skills.find((s) => s.topic === 'addition');

    expect(skill).toMatchObject({ attempts: 2, correct: 1 });
  });
});

describe('readSittings', () => {
  it('returns [] for a child who has never played, not null', async () => {
    const childId = await makeChild(await makeParent());
    expect(await readSittings(childId, 'maths')).toEqual([]);
  });

  it('never spends the limit on a sitting nobody answered a question in', async () => {
    const childId = await makeChild(await makeParent());

    // The shape the live data actually takes: the play screen opens a sitting on
    // every mount, so a child bouncing in and out leaves a trail of empty rows
    // between the real ones. Newest first, an empty one on top.
    for (let i = 0; i < 3; i += 1) {
      const answered = await aSession(childId);
      await recordAttempt(childId, answered, anAttempt());
      await aSession(childId);
    }

    const sittings = await readSittings(childId, 'maths', 2);

    // Two real sittings, rather than one real one and an empty row's worth of
    // nothing - the limit counts what the parent is shown.
    expect(sittings).toHaveLength(2);
    expect(sittings?.every((sitting) => sitting.attempts === 1)).toBe(true);
  });
});
