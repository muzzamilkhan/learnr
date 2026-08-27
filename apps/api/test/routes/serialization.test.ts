import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { startDatabase, stopDatabase, truncateAll, testPrisma } from '../helpers/db.js';
import { makeChild, makeParent } from '../helpers/factories.js';
import { buildServer } from '../../src/server.js';
import { recordAttempt, recordSessionStart } from '../../src/data/records.js';
import { submitSpeedRun } from '../../src/data/speed-records.js';
import { issueLoginCode } from '../../src/data/accounts.js';

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

const PHOTO = 'data:image/webp;base64,UklGRhoAAABXRUJQVlA4TA0AAAAvAAAAEAcQERGIiP4H';

/**
 * All four mark kinds in one drawing, because `markSchema` is a discriminated
 * union and a test that only ever sends a path proves three quarters of nothing.
 */
const FIGURE = {
  width: 100,
  height: 80,
  marks: [
    { kind: 'path', points: [[0, 0], [10, 0], [5, 9]], closed: true, fill: false, dashed: true },
    { kind: 'arc', at: [5, 5], radius: 3, from: 0, to: 90 },
    { kind: 'dot', at: [1, 2] },
    { kind: 'label', at: [50, 50], text: 'A' },
  ],
} as const;

/** Answers on one topic, some right and some wrong, so no ratio lands on 0 or 1. */
async function answerMixed(childId: string): Promise<void> {
  const sessionId = (await recordSessionStart({
    userId: childId,
    subject: 'maths',
    level: '3',
    seed: 's',
  }))!;

  for (const [index, correct] of [true, true, false].entries()) {
    await recordAttempt(childId, sessionId, {
      id: randomUUID(),
      templateId: 'maths.3.addition.sum',
      subject: 'maths',
      topic: 'addition',
      level: '3',
      prompt: 'What is 2 + 2?',
      expected: '4',
      response: correct ? '4' : '5',
      correct,
      timeTakenMs: 3000 + index,
      answeredAt: Date.now() + index,
      offsetMinutes: 600,
    });
  }
}

async function answerWithFigure(childId: string): Promise<void> {
  const sessionId = (await recordSessionStart({
    userId: childId,
    subject: 'maths',
    level: '3',
    seed: 's',
  }))!;

  await recordAttempt(childId, sessionId, {
    id: randomUUID(),
    templateId: 'maths.3.space.name-the-shape',
    subject: 'maths',
    topic: 'shapes',
    level: '3',
    prompt: 'What shape is this?',
    expected: 'triangle',
    response: 'square',
    correct: false,
    timeTakenMs: 4000,
    answeredAt: Date.now(),
    offsetMinutes: 600,
    figure: FIGURE,
  });
}

/**
 * These endpoints used to answer `z.unknown()`, which serializes by passing the
 * value through untouched. A real schema does not: Fastify runs the response
 * through it, and a zod object **strips what it does not declare**. So a field
 * left out of a schema does not fail loudly - it silently vanishes, and the
 * client sees a smaller object that parses perfectly well.
 *
 * The compiler catches the dropping itself (`Mirrored` in `schemas/dto.ts`).
 * What it cannot catch is a value the schema describes too *tightly* - saying
 * `integer` where a ratio is 0.67 does not strip anything, it throws, and the
 * endpoint 500s. That only shows against real data, and only against data
 * awkward enough to reach it.
 *
 * So these send the awkward things on purpose: all four mark kinds, a photo, a
 * live code, an optional avatar, a shared child, both arms of the mode union,
 * and answers that are neither all right nor all wrong. Each of these was
 * checked by breaking the schema it covers and watching this file go red.
 */
describe('nothing is dropped on the way out', () => {
  it('carries a whole figure, every mark kind, through the answers read', async () => {
    const parentId = await makeParent();
    const childId = await makeChild(parentId);
    await answerWithFigure(childId);

    const response = await app.inject({
      method: 'GET',
      url: `/children/${childId}/answers?subject=maths`,
      headers: as(await signIn(parentId)),
    });

    expect(response.statusCode).toBe(200);
    const [answer] = response.json();
    expect(answer).toMatchObject({
      topic: 'shapes',
      prompt: 'What shape is this?',
      expected: 'triangle',
      response: 'square',
      correct: false,
    });
    // The whole drawing, not a figure-shaped object with its marks emptied.
    expect(answer.figure).toEqual(FIGURE);
  });

  it('carries the same figure through the batched record read', async () => {
    const parentId = await makeParent();
    const childId = await makeChild(parentId);
    await answerWithFigure(childId);

    const response = await app.inject({
      method: 'GET',
      url: `/children/${childId}/record?subject=maths`,
      headers: as(await signIn(parentId)),
    });

    expect(response.json().answers[0].figure).toEqual(FIGURE);
    // `templateId` and `offsetMinutes` are optional on an Observation, so they
    // are exactly the pair a schema is most likely to leave out.
    expect(response.json().observations[0]).toMatchObject({
      topic: 'shapes',
      templateId: 'maths.3.space.name-the-shape',
      offsetMinutes: 600,
    });
  });

  it('carries a photograph and an avatar on the account', async () => {
    const childId = await makeChild(await makeParent(), { avatar: 'owl' });
    await testPrisma().childPhoto.create({ data: { childId, dataUrl: PHOTO } });

    const response = await app.inject({
      method: 'GET',
      url: '/me',
      headers: as(await signIn(childId)),
    });

    expect(response.json()).toMatchObject({ avatar: 'owl', photo: PHOTO, role: 'child' });
  });

  it('carries a live code, its expiry and a target on a child profile', async () => {
    const parentId = await makeParent();
    const childId = await makeChild(parentId);
    await testPrisma().user.update({
      where: { id: childId },
      data: { targetKind: 'minutes', targetValue: 15 },
    });
    await issueLoginCode(parentId, childId, new Date());

    const response = await app.inject({
      method: 'GET',
      url: '/children',
      headers: as(await signIn(parentId)),
    });

    const [child] = response.json();
    expect(child.code).toMatch(/^[A-Z0-9]{4}$/);
    expect(child.target).toEqual({ kind: 'minutes', value: 15 });
    // A Date on this side, an ISO 8601 string on the wire - which is what lets
    // the contract document it as `format: date-time`.
    expect(typeof child.codeExpiresAt).toBe('string');
    expect(Number.isNaN(Date.parse(child.codeExpiresAt))).toBe(false);
  });

  it('carries access and sharedBy on a shared child', async () => {
    const owner = await makeParent({ name: 'Sam' });
    const childId = await makeChild(owner, { name: 'Shared' });
    const viewer = await makeParent();
    const viewerToken = await signIn(viewer);

    const created = await app.inject({
      method: 'POST', url: '/shares', headers: as(await signIn(owner)),
      payload: { childIds: [childId] },
    });
    await app.inject({
      method: 'POST', url: `/shares/${created.json().token}/accept`, headers: as(viewerToken),
    });

    const response = await app.inject({
      method: 'GET', url: '/children/viewable', headers: as(viewerToken),
    });

    expect(response.json()).toHaveLength(1);
    expect(response.json()[0]).toMatchObject({ name: 'Shared', access: 'viewer', sharedBy: 'Sam' });
  });

  it('carries the optional face columns on a leaderboard row', async () => {
    const parentId = await makeParent({ name: 'Grown-up' });
    const childId = await makeChild(parentId, { name: 'Ada', avatar: 'frog' });
    await testPrisma().childPhoto.create({ data: { childId, dataUrl: PHOTO } });
    await submitSpeedRun(childId, { id: randomUUID(), mode: { op: 'multiply', tables: 7 }, correct: 12 });

    const response = await app.inject({
      method: 'GET', url: '/speed/records', headers: as(await signIn(childId)),
    });

    const [row] = response.json().family;
    // All three are optional on FamilyRecord, which is precisely why they are
    // worth asserting: an optional field a schema forgets is invisible.
    expect(row).toMatchObject({
      playerName: 'Ada',
      playerAvatar: 'frog',
      playerPhoto: PHOTO,
      mode: 'multiply.7',
      best: 12,
    });
    expect(typeof row.achievedAt).toBe('string');
  });

  it('carries every branch of the report', async () => {
    const parentId = await makeParent();
    const childId = await makeChild(parentId);
    await answerWithFigure(childId);

    const response = await app.inject({
      method: 'GET',
      url: `/children/${childId}/report?subject=maths`,
      headers: as(await signIn(parentId)),
    });

    const body = response.json();
    expect(Object.keys(body).sort()).toEqual(
      ['clusters', 'due', 'headline', 'problems', 'progress', 'strengths', 'sittings', 'topics'].sort(),
    );
    expect(body.headline).toMatchObject({ questions: 1 });
    expect(body.topics[0]).toMatchObject({ topic: 'shapes', level: '3', attempts: 1 });
    expect(body.sittings[0]).toMatchObject({ attempts: 1, correct: 0 });
    expect(body.progress.length).toBeGreaterThan(0);
  });

  it('carries the learner profile through the play state', async () => {
    const childId = await makeChild(await makeParent());
    await answerWithFigure(childId);

    const response = await app.inject({
      method: 'GET',
      url: '/play/state?subject=maths&level=3',
      headers: as(await signIn(childId)),
    });

    expect(response.json().profile.skills[0]).toMatchObject({
      topic: 'shapes',
      level: '3',
      attempts: 1,
    });
  });

  /**
   * The ratios are the fields most likely to be described too tightly, and a
   * schema saying `integer` where the value is 0.67 does not strip anything - it
   * throws, and the endpoint 500s.
   *
   * A suite that only ever answers all-right or all-wrong cannot see that: every
   * ratio is 0 or 1, which *is* an integer. This one deliberately answers two
   * out of three, and asserts the numbers really are fractional so it cannot
   * quietly stop testing what it is here to test.
   */
  it('carries a ratio that is not a whole number', async () => {
    const parentId = await makeParent();
    const childId = await makeChild(parentId);
    await answerMixed(childId);

    const state = await app.inject({
      method: 'GET',
      url: '/play/state?subject=maths&level=3',
      headers: as(await signIn(childId)),
    });
    expect(state.statusCode).toBe(200);
    const { strength } = state.json().profile.skills[0];
    expect(Number.isInteger(strength)).toBe(false);

    const report = await app.inject({
      method: 'GET',
      url: `/children/${childId}/report?subject=maths`,
      headers: as(await signIn(parentId)),
    });
    expect(report.statusCode).toBe(200);
    expect(report.json().topics[0].accuracy).toBeCloseTo(2 / 3);
    expect(Number.isInteger(report.json().topics[0].accuracy)).toBe(false);
    expect(Number.isInteger(report.json().headline.accuracy)).toBe(false);
    expect(Number.isInteger(report.json().progress.at(-1).accuracy)).toBe(false);
  });

  /**
   * A mode is a union with two arms and only one of them carries `tables`, so a
   * schema that described the difficulty arm alone would empty every times
   * table in the list without failing anything.
   */
  it('carries both arms of the mode union', async () => {
    const modes = (await app.inject({ method: 'GET', url: '/speed/modes' })).json();

    const table = modes.find((mode: { key: string }) => mode.key === 'multiply.7');
    const difficulty = modes.find((mode: { key: string }) => mode.key === 'add.hard');

    expect(table).toEqual({ key: 'multiply.7', op: 'multiply', tables: 7 });
    expect(difficulty).toEqual({ key: 'add.hard', op: 'add', difficulty: 'hard' });
  });
});
