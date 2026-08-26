import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { startDatabase, stopDatabase, truncateAll, testPrisma } from '../helpers/db.js';
import { makeChild, makeParent } from '../helpers/factories.js';
import {
  claimParentRole,
  issueLoginCode,
  listChildren,
  readAccount,
  redeemLoginCode,
  removeChild,
} from '../../src/data/accounts.js';

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
    expect(first).not.toBeNull();

    const second = await redeemLoginCode(code!);
    expect(second).toBeNull();
  });

  it('will not redeem an expired code', async () => {
    const parentId = await makeParent();
    const childId = await makeChild(parentId);
    const code = await issueLoginCode(parentId, childId, new Date(Date.now() - 2 * 60 * 60 * 1000));

    expect(await redeemLoginCode(code!)).toBeNull();
  });

  it('will not issue a code for another parent-s child', async () => {
    const mine = await makeParent();
    const theirs = await makeParent();
    const theirChild = await makeChild(theirs);

    expect(await issueLoginCode(mine, theirChild)).toBeNull();
  });
});
