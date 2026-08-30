import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { startDatabase, stopDatabase, truncateAll, testPrisma } from './test-helpers/db';
import { makeChild, makeParent } from './test-helpers/factories';
import {
  claimParentRole,
  createChild,
  issueLoginCode,
  listChildren,
  readAccount,
  redeemLoginCode,
  removeChild,
  updateChild,
} from './accounts';

beforeAll(startDatabase);
afterAll(stopDatabase);
beforeEach(truncateAll);

describe('readAccount', () => {
  it('reads a parent', async () => {
    const parentId = await makeParent({ name: 'Ada' });
    const account = await readAccount(parentId);

    expect(account).toMatchObject({ id: parentId, role: 'parent', parentId: null });
  });

  it('returns null for someone who does not exist', async () => {
    expect(await readAccount('nobody')).toBeNull();
  });
});

// The plan called this `chooseRole(userId, role)`. learnr#671f719 - "Make a
// Google sign-in only ever a parent" - replaced it with claimParentRole, which
// takes no role and writes only where the role is still null. The tests below
// keep the original intent: a role is set once and never overwritten.
describe('claimParentRole', () => {
  it('sets a role that was not set', async () => {
    const user = await testPrisma().user.create({ data: { name: 'New' } });
    expect(await claimParentRole(user.id)).toBe(true);
    expect((await readAccount(user.id))?.role).toBe('parent');
  });

  it('refuses to overwrite a role that is already set', async () => {
    const parentId = await makeParent();
    expect(await claimParentRole(parentId)).toBe(false);
    expect((await readAccount(parentId))?.role).toBe('parent');
  });

  // The reason the guard is `where role: null` rather than `where role != parent`:
  // a managed child must never be promoted by a stray sign-in.
  it('will not promote a managed child', async () => {
    const parentId = await makeParent();
    const childId = await makeChild(parentId);

    expect(await claimParentRole(childId)).toBe(false);
    expect((await readAccount(childId))?.role).toBe('child');
  });
});

describe('listChildren', () => {
  it('lists only this parent-s children', async () => {
    const mine = await makeParent();
    const theirs = await makeParent();
    await makeChild(mine, { name: 'Mine' });
    await makeChild(theirs, { name: 'Theirs' });

    const children = await listChildren(mine);

    expect(children).toHaveLength(1);
    expect(children?.[0]?.name).toBe('Mine');
  });

  // The dashboard draws them on the card and the form opens on them, so they
  // come back with the rest of the profile rather than in a read of their own.
  it('reports the subjects each child is offered', async () => {
    const parentId = await makeParent();
    await makeChild(parentId, { subjects: ['english'] });

    expect((await listChildren(parentId))?.[0]?.subjects).toEqual(['english']);
  });
});

describe('removeChild', () => {
  it('refuses to remove a child belonging to someone else', async () => {
    const mine = await makeParent();
    const theirs = await makeParent();
    const theirChild = await makeChild(theirs);

    expect(await removeChild(mine, theirChild)).toBe(false);
    expect(await readAccount(theirChild)).not.toBeNull();
  });
});

describe('the login code', () => {
  it('is spent at redemption, so it works exactly once', async () => {
    const parentId = await makeParent();
    const childId = await makeChild(parentId);

    const code = await issueLoginCode(parentId, childId);
    expect(code).toBeTypeOf('string');

    const first = await redeemLoginCode(code!);
    expect(first.status).toBe('redeemed');

    // Spent, not broken: a second go is a rejection and nothing else.
    const second = await redeemLoginCode(code!);
    expect(second).toEqual({ status: 'rejected' });
  });

  it('will not redeem an expired code', async () => {
    const parentId = await makeParent();
    const childId = await makeChild(parentId);
    const code = await issueLoginCode(parentId, childId, new Date(Date.now() - 2 * 60 * 60 * 1000));

    expect(await redeemLoginCode(code!)).toEqual({ status: 'rejected' });
  });

  it('rejects a code that is not a code at all, rather than saying it cannot tell', async () => {
    // The distinction the status exists for: this one really is the typist's
    // fault, so it is a rejection and it counts as a guess.
    expect(await redeemLoginCode('!!!!')).toEqual({ status: 'rejected' });
    expect(await redeemLoginCode('')).toEqual({ status: 'rejected' });
  });

  it('will not issue a code for another parent-s child', async () => {
    const mine = await makeParent();
    const theirs = await makeParent();
    const theirChild = await makeChild(theirs);

    expect(await issueLoginCode(mine, theirChild)).toBeNull();
  });
});

/**
 * A child profile is a `User` row with no email and no `Account` - there is
 * nothing OAuth about it. `createChild` takes the shapes the boundary parsers
 * produce (`Avatar`, `DailyTarget`), never the strings a form submitted, so an
 * avatar that does not exist cannot reach it: `parseChildInput` in
 * `src/app/actions.ts` is where a form's answer is decided.
 */
describe('createChild', () => {
  it('stores the profile against the parent who made it', async () => {
    const parentId = await makeParent();

    const childId = await createChild(parentId, {
      name: 'Ada',
      avatar: 'fox',
      photo: null,
      level: '3',
      target: { kind: 'questions', value: 10 },
      subjects: ['maths', 'english'],
    });

    expect(childId).toBeTypeOf('string');
    expect(await testPrisma().user.findUnique({ where: { id: childId! } })).toMatchObject({
      name: 'Ada', avatar: 'fox', selectedLevel: '3',
      targetKind: 'questions', targetValue: 10, parentId, role: 'child',
      subjects: ['maths', 'english'],
    });
  });

  // What a parent may practise their child on is theirs to set, so it is stored
  // as chosen rather than defaulted to everything with content.
  it('stores a child offered one subject', async () => {
    const parentId = await makeParent();

    const childId = await createChild(parentId, {
      name: 'Ada', avatar: 'fox', photo: null, level: '3', target: null,
      subjects: ['maths'],
    });

    expect(await testPrisma().user.findUnique({ where: { id: childId! } })).toMatchObject({
      subjects: ['maths'],
    });
  });
});

describe('updateChild', () => {
  it('changes a child this parent owns', async () => {
    const parentId = await makeParent();
    const childId = await makeChild(parentId, { name: 'Ada' });

    const ok = await updateChild(parentId, childId, {
      name: 'Grace', avatar: 'owl', photo: null, level: '5', target: null,
      subjects: ['maths', 'english'],
    });

    expect(ok).toBe(true);
    expect(await testPrisma().user.findUnique({ where: { id: childId } })).toMatchObject({
      name: 'Grace', avatar: 'owl', selectedLevel: '5', targetKind: null,
      subjects: ['maths', 'english'],
    });
  });

  // Taking a subject away is the half worth proving: the column is written as
  // the whole list every time rather than added to, so a subject dropped from
  // the form is a subject the child stops being offered.
  it('takes a subject away', async () => {
    const parentId = await makeParent();
    const childId = await makeChild(parentId, { subjects: ['maths', 'english'] });

    await updateChild(parentId, childId, {
      name: 'Ada', avatar: 'fox', photo: null, level: '3', target: null,
      subjects: ['english'],
    });

    expect(await testPrisma().user.findUnique({ where: { id: childId } })).toMatchObject({
      subjects: ['english'],
    });
  });

  // The child id round-trips through the browser, so every mutation scopes its
  // `where` by `parentId` as well as `id`. There is no separate check to drift.
  it('refuses a child belonging to someone else', async () => {
    const mine = await makeParent();
    const theirs = await makeParent();
    const theirChild = await makeChild(theirs, { name: 'Theirs' });

    const ok = await updateChild(mine, theirChild, {
      name: 'Taken', avatar: 'owl', photo: null, level: '5', target: null,
      subjects: ['maths'],
    });

    expect(ok).toBe(false);
    expect(await testPrisma().user.findUnique({ where: { id: theirChild } }))
      .toMatchObject({ name: 'Theirs' });
  });
});
