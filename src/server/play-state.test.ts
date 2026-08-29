import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { startDatabase, stopDatabase, truncateAll, testPrisma } from './test-helpers/db';
import { makeChild, makeParent } from './test-helpers/factories';
import { readPlayer, readPlayState } from './play-state';
import { recordAttempt, recordSessionStart, writeSelectedLevel } from './records';

beforeAll(startDatabase);
afterAll(stopDatabase);
beforeEach(truncateAll);

async function play(childId: string, count: number): Promise<void> {
  const sessionId = (await recordSessionStart({
    userId: childId, subject: 'maths', level: '3', seed: 's',
  }))!;
  for (let i = 0; i < count; i++) {
    await recordAttempt(childId, sessionId, {
      id: randomUUID(), templateId: 't', subject: 'maths', topic: 'addition',
      level: '3', prompt: 'p', expected: '4', response: '4', correct: true,
      timeTakenMs: 1000, answeredAt: Date.now() + i, offsetMinutes: 600,
    });
  }
}

const giveTarget = (childId: string) =>
  testPrisma().user.update({
    where: { id: childId },
    data: { targetKind: 'questions', targetValue: 10 },
  });

/**
 * The play screen makes five reads. Asked one at a time they are a waterfall in
 * front of the first question, which is why four of them go in parallel here.
 */
describe('readPlayState', () => {
  it('answers with an empty profile for a child who has never played', async () => {
    const childId = await makeChild(await makeParent());

    const state = await readPlayState(childId, 'maths', '3', 5);

    expect(state.profile.skills).toEqual([]);
    expect(state.recentTopics).toEqual([]);
    expect(state.player.stars).toBe(0);
    expect(state.player.selectedLevel).toBe('3');
  });

  it('returns the profile, topics and player state a sitting needs', async () => {
    const childId = await makeChild(await makeParent());
    await play(childId, 3);

    const state = await readPlayState(childId, 'maths', '3', 5);

    expect(state.profile.skills.find((skill) => skill.topic === 'addition')).toBeTruthy();
    expect(state.recentTopics).toContain('addition');
    expect(state.player.streak).toBeTruthy();
  });

  // The page used to make this decision itself and would otherwise read a window
  // of answers for a child with no goal to measure them against.
  it('carries a window of answers only for a child with a target', async () => {
    const childId = await makeChild(await makeParent());
    await play(childId, 3);

    expect((await readPlayState(childId, 'maths', '3', 5)).targetAnswers).toEqual([]);
    await giveTarget(childId);
    expect((await readPlayState(childId, 'maths', '3', 5)).targetAnswers).toHaveLength(3);
  });

  /**
   * A managed child's year is their parent's decision, enforced against the one
   * in the URL - so the screen has to read `player.selectedLevel` before it knows
   * whether the URL's year is allowed, and the URL's year may be nonsense.
   * Refusing a level that is not a school year would refuse the very read that
   * would have sent the child to their own.
   */
  it('still answers with the player state when there is no level', async () => {
    const childId = await makeChild(await makeParent(), { level: '2' });
    await play(childId, 3);

    const state = await readPlayState(childId, 'maths', null, 5);

    expect(state.player.selectedLevel).toBe('2');
    expect(state.recentTopics).toEqual([]);
    expect(state.profile.skills.length).toBeGreaterThan(0);
  });
});

/**
 * The home screen wants the four numbers off the child's own row and the window
 * the goal bar folds - and it has no subject or year to ask about, because
 * picking one is what that screen is for. So it is `readPlayState` minus the two
 * reads that need a course, rather than a level invented to satisfy a shape.
 */
describe('readPlayer', () => {
  it('answers with the level, streak, stars and goal', async () => {
    const childId = await makeChild(await makeParent(), { level: '4' });

    const { player, targetAnswers } = await readPlayer(childId);

    expect(player.selectedLevel).toBe('4');
    expect(player.stars).toBe(0);
    expect(player.target).toBeNull();
    expect(targetAnswers).toEqual([]);
  });

  it('carries a window of answers only for a child with a target', async () => {
    const childId = await makeChild(await makeParent());
    await play(childId, 3);

    expect((await readPlayer(childId)).targetAnswers).toEqual([]);
    await giveTarget(childId);
    expect((await readPlayer(childId)).targetAnswers).toHaveLength(3);
  });
});

describe('writeSelectedLevel', () => {
  it('stores the level the child chose', async () => {
    const childId = await makeChild(await makeParent(), { level: '2' });

    await writeSelectedLevel(childId, '5');

    expect((await readPlayer(childId)).player.selectedLevel).toBe('5');
  });
});
