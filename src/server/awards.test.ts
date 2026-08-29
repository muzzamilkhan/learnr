import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { startDatabase, stopDatabase, truncateAll, testPrisma, warmPool } from './test-helpers/db';
import { makeChild, makeParent } from './test-helpers/factories';
import {
  awardDailyTarget,
  awardRoundStars,
  recordAttempt,
  recordSessionStart,
} from './records';
import type { Attempt } from '@/lib/session/session';
import { TARGET_STARS } from '@/lib/rewards/target';

beforeAll(startDatabase);
afterAll(stopDatabase);
beforeEach(truncateAll);

const NOW = Date.UTC(2026, 7, 26, 9, 0, 0);
const OFFSET = 600; // Ten hours east: a Sydney evening.

function anAttempt(index: number, correct: boolean): Attempt {
  return {
    templateId: 'maths.3.addition.sum',
    subject: 'maths',
    topic: 'addition',
    level: '3',
    prompt: 'What is 2 + 2?',
    expected: '4',
    response: correct ? '4' : '5',
    correct,
    timeTakenMs: 1000,
    answeredAt: NOW + index * 1000,
    offsetMinutes: OFFSET,
  };
}

async function playRound(childId: string, sessionId: string, correct: number): Promise<void> {
  for (let i = 0; i < 10; i++) {
    await recordAttempt(childId, sessionId, anAttempt(i, i < correct));
  }
}

describe('awardRoundStars', () => {
  it('pays three stars for a clean round', async () => {
    const childId = await makeChild(await makeParent());
    const sessionId = (await recordSessionStart({
      userId: childId, subject: 'maths', level: '3', seed: 's',
    }))!;

    await playRound(childId, sessionId, 10);

    expect(await awardRoundStars(childId, sessionId)).toBe(3);
  });

  it('pays for a round exactly once, however many times it is asked', async () => {
    const childId = await makeChild(await makeParent());
    const sessionId = (await recordSessionStart({
      userId: childId, subject: 'maths', level: '3', seed: 's',
    }))!;

    await playRound(childId, sessionId, 10);

    const first = await awardRoundStars(childId, sessionId);
    const second = await awardRoundStars(childId, sessionId);

    expect(first).toBe(3);
    expect(second).toBeNull();

    const child = await testPrisma().user.findUnique({ where: { id: childId } });
    expect(child?.stars).toBe(3);
  });

  // Eight racers, not the plan's two. Measured against a build with the
  // SELECT ... FOR UPDATE stripped out: two callers produce 3 stars and the
  // test passes anyway, because they rarely overlap. Four produce 6, eight
  // produce 12. A guard test that cannot fail when the guard is gone is not
  // testing the guard.
  it('pays once when calls race, not once per caller', async () => {
    const childId = await makeChild(await makeParent());
    const sessionId = (await recordSessionStart({
      userId: childId, subject: 'maths', level: '3', seed: 's',
    }))!;

    await playRound(childId, sessionId, 10);
    await warmPool();

    const results = await Promise.all(
      Array.from({ length: 8 }, () => awardRoundStars(childId, sessionId)),
    );

    // Exactly one caller banks the round; the rest are told there was nothing.
    expect(results.filter((stars) => stars !== null)).toEqual([3]);

    const child = await testPrisma().user.findUnique({ where: { id: childId } });
    expect(child?.stars).toBe(3);
  });

  it('does not pay for a round belonging to someone else-s session', async () => {
    const parentId = await makeParent();
    const mine = await makeChild(parentId);
    const theirs = await makeChild(parentId);
    const sessionId = (await recordSessionStart({
      userId: theirs, subject: 'maths', level: '3', seed: 's',
    }))!;

    await playRound(theirs, sessionId, 10);

    expect(await awardRoundStars(mine, sessionId)).toBeNull();
  });
});

describe('awardDailyTarget', () => {
  // Ten, not the plan's five: TARGET_LIMITS floors a questions target at ten -
  // "exactly one round" - so parseTarget refuses five and awardDailyTarget
  // never gets as far as counting. The floor is the point, so the test below
  // pins it rather than working around it.
  it('pays the day-s target once, and not again that day', async () => {
    const parentId = await makeParent();
    const childId = await makeChild(parentId);
    await testPrisma().user.update({
      where: { id: childId },
      data: { targetKind: 'questions', targetValue: 10 },
    });

    const sessionId = (await recordSessionStart({
      userId: childId, subject: 'maths', level: '3', seed: 's',
    }))!;
    await playRound(childId, sessionId, 10);

    expect(await awardDailyTarget(childId, sessionId, { now: NOW, offsetMinutes: OFFSET })).toBe(true);
    expect(await awardDailyTarget(childId, sessionId, { now: NOW, offsetMinutes: OFFSET })).toBe(false);

    const child = await testPrisma().user.findUnique({ where: { id: childId } });
    expect(child?.stars).toBe(TARGET_STARS); // the round's stars are a separate call
  });

  it('pays once when calls race, not once per caller', async () => {
    const childId = await makeChild(await makeParent());
    await testPrisma().user.update({
      where: { id: childId },
      data: { targetKind: 'questions', targetValue: 10 },
    });
    const sessionId = (await recordSessionStart({
      userId: childId, subject: 'maths', level: '3', seed: 's',
    }))!;
    await playRound(childId, sessionId, 10);
    await warmPool();

    const results = await Promise.all(
      Array.from({ length: 8 }, () =>
        awardDailyTarget(childId, sessionId, { now: NOW, offsetMinutes: OFFSET }),
      ),
    );

    // The compare-and-set on targetDay is a single statement, so exactly one
    // caller can match the row - eight racers for the same reason as above.
    expect(results.filter(Boolean)).toEqual([true]);

    const child = await testPrisma().user.findUnique({ where: { id: childId } });
    expect(child?.stars).toBe(TARGET_STARS);
  });

  // A target below the floor is not a target. Stored directly - a parent's form
  // cannot produce it - it must still be refused rather than silently paid.
  it('ignores a stored target below what a parent could have set', async () => {
    const childId = await makeChild(await makeParent());
    await testPrisma().user.update({
      where: { id: childId },
      data: { targetKind: 'questions', targetValue: 5 },
    });

    const sessionId = (await recordSessionStart({
      userId: childId, subject: 'maths', level: '3', seed: 's',
    }))!;
    await playRound(childId, sessionId, 10);

    expect(await awardDailyTarget(childId, sessionId, { now: NOW, offsetMinutes: OFFSET })).toBe(false);
  });

  it('does not pay before the target is reached', async () => {
    const childId = await makeChild(await makeParent());
    await testPrisma().user.update({
      where: { id: childId },
      data: { targetKind: 'questions', targetValue: 20 },
    });

    const sessionId = (await recordSessionStart({
      userId: childId, subject: 'maths', level: '3', seed: 's',
    }))!;
    await recordAttempt(childId, sessionId, anAttempt(0, true));

    expect(await awardDailyTarget(childId, sessionId, { now: NOW, offsetMinutes: OFFSET })).toBe(false);
  });
});
