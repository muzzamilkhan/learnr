import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { startDatabase, stopDatabase, truncateAll, testPrisma } from './test-helpers/db';
import { makeChild, makeParent, makePassword } from './test-helpers/factories';
import {
  codeIdentifier,
  grantIdentifier,
} from '@/lib/verification-code';
import {
  issueVerificationCode,
  setPasswordWithGrant,
  signInWithPassword,
  spendVerificationCode,
} from './passwords';

beforeAll(startDatabase);
afterAll(stopDatabase);
beforeEach(truncateAll);

describe('signInWithPassword', () => {
  it('authenticates a parent with the right password', async () => {
    const parentId = await makeParent({ email: 'ada@example.com' });
    await makePassword(parentId, 'correct horse battery');

    const result = await signInWithPassword('ada@example.com', 'correct horse battery');

    expect(result.status).toBe('authenticated');
    if (result.status !== 'authenticated') return;
    expect(result.session.userId).toBe(parentId);
  });

  // The session it writes is the row the Prisma adapter would have written, so
  // `auth()` cannot tell this path from Google's.
  it('writes a Session row auth() can read', async () => {
    const parentId = await makeParent({ email: 'ada@example.com' });
    await makePassword(parentId, 'correct horse battery');

    const result = await signInWithPassword('ada@example.com', 'correct horse battery');
    if (result.status !== 'authenticated') throw new Error('expected authenticated');

    const session = await testPrisma().session.findUnique({
      where: { sessionToken: result.session.token },
    });
    expect(session?.userId).toBe(parentId);
  });

  it('folds the case of the address', async () => {
    const parentId = await makeParent({ email: 'ada@example.com' });
    await makePassword(parentId, 'correct horse battery');

    const result = await signInWithPassword('  Ada@Example.com ', 'correct horse battery');
    expect(result.status).toBe('authenticated');
  });

  it('refuses the wrong password', async () => {
    const parentId = await makeParent({ email: 'ada@example.com' });
    await makePassword(parentId, 'correct horse battery');

    expect((await signInWithPassword('ada@example.com', 'wrong')).status).toBe('rejected');
  });

  // Same answer as a wrong password, deliberately: a different one would turn
  // this form into a way to ask whether an address has an account here.
  it('refuses an address with no account', async () => {
    expect((await signInWithPassword('nobody@example.com', 'anything at all')).status)
      .toBe('rejected');
  });

  it('refuses a parent who has no password', async () => {
    await makeParent({ email: 'ada@example.com' });
    expect((await signInWithPassword('ada@example.com', 'anything at all')).status)
      .toBe('rejected');
  });

  // A child cannot reach the flow that sets one, so this is a row that should
  // not exist - and it is refused on the role rather than on the absence.
  it('refuses a child, even holding a password', async () => {
    const parentId = await makeParent();
    const childId = await makeChild(parentId);
    await testPrisma().user.update({
      where: { id: childId },
      data: { email: 'kid@example.com' },
    });
    await makePassword(childId, 'correct horse battery');

    expect((await signInWithPassword('kid@example.com', 'correct horse battery')).status)
      .toBe('rejected');
  });

  it('refuses an address that was never verified', async () => {
    const parentId = await makeParent({ email: 'ada@example.com' });
    await makePassword(parentId, 'correct horse battery');
    await testPrisma().user.update({
      where: { id: parentId },
      data: { emailVerified: null },
    });

    expect((await signInWithPassword('ada@example.com', 'correct horse battery')).status)
      .toBe('rejected');
  });

  it('refuses an address that will not normalise', async () => {
    expect((await signInWithPassword('not an address', 'anything at all')).status)
      .toBe('rejected');
  });
});

describe('issueVerificationCode', () => {
  it('stores a code against the address', async () => {
    expect(await issueVerificationCode('ada@example.com', '123456')).toBe(true);

    const row = await testPrisma().verificationToken.findFirst({
      where: { identifier: codeIdentifier('ada@example.com') },
    });
    expect(row?.token).toBe('123456');
  });

  // Asking for a second code must not leave the first one working: a code lying
  // around in an old mail is a live credential nobody is watching.
  it('replaces a code already outstanding for the address', async () => {
    await issueVerificationCode('ada@example.com', '111111');
    await issueVerificationCode('ada@example.com', '222222');

    const rows = await testPrisma().verificationToken.findMany({
      where: { identifier: codeIdentifier('ada@example.com') },
    });
    expect(rows.map((row) => row.token)).toEqual(['222222']);
  });

  it('writes nothing for an address that will not normalise', async () => {
    expect(await issueVerificationCode('not an address', '123456')).toBe(false);
    expect(await testPrisma().verificationToken.count()).toBe(0);
  });
});

describe('spendVerificationCode', () => {
  it('verifies the right code and leaves a grant', async () => {
    await issueVerificationCode('ada@example.com', '123456');

    expect(await spendVerificationCode('ada@example.com', '123456', 'grant-token'))
      .toBe('verified');

    const grant = await testPrisma().verificationToken.findFirst({
      where: { identifier: grantIdentifier('ada@example.com') },
    });
    expect(grant?.token).toBe('grant-token');
  });

  it('spends the code, so it cannot be used twice', async () => {
    await issueVerificationCode('ada@example.com', '123456');
    await spendVerificationCode('ada@example.com', '123456', 'grant-one');

    expect(await spendVerificationCode('ada@example.com', '123456', 'grant-two'))
      .toBe('rejected');
  });

  it('rejects the wrong code', async () => {
    await issueVerificationCode('ada@example.com', '123456');
    expect(await spendVerificationCode('ada@example.com', '999999', 'grant-token'))
      .toBe('rejected');
  });

  it('rejects a code that has run out', async () => {
    const issued = new Date('2026-09-05T10:00:00Z');
    const late = new Date('2026-09-05T11:00:00Z');
    await issueVerificationCode('ada@example.com', '123456', issued);

    expect(await spendVerificationCode('ada@example.com', '123456', 'grant-token', late))
      .toBe('rejected');
  });

  it("rejects another address's code", async () => {
    await issueVerificationCode('ada@example.com', '123456');
    expect(await spendVerificationCode('bob@example.com', '123456', 'grant-token'))
      .toBe('rejected');
  });
});

describe('setPasswordWithGrant', () => {
  const verified = async (email: string, grant: string) => {
    await issueVerificationCode(email, '123456');
    await spendVerificationCode(email, '123456', grant);
  };

  it('creates a parent when the address is unknown', async () => {
    await verified('ada@example.com', 'grant-token');

    const result = await setPasswordWithGrant('grant-token', 'correct horse battery');
    expect(result.status).toBe('authenticated');

    const user = await testPrisma().user.findUnique({ where: { email: 'ada@example.com' } });
    expect(user?.role).toBe('parent');
    expect(user?.emailVerified).not.toBeNull();
  });

  it('signs them straight in', async () => {
    await verified('ada@example.com', 'grant-token');
    const result = await setPasswordWithGrant('grant-token', 'correct horse battery');
    if (result.status !== 'authenticated') throw new Error('expected authenticated');

    const session = await testPrisma().session.findUnique({
      where: { sessionToken: result.session.token },
    });
    expect(session?.userId).toBe(result.session.userId);
  });

  it('leaves a password that signs in afterwards', async () => {
    await verified('ada@example.com', 'grant-token');
    await setPasswordWithGrant('grant-token', 'correct horse battery');

    expect((await signInWithPassword('ada@example.com', 'correct horse battery')).status)
      .toBe('authenticated');
  });

  // Row two of the spec's table: the Google parent gets a password on the
  // account they already have, rather than a second one.
  it('attaches to the account an address already has', async () => {
    const parentId = await makeParent({ email: 'ada@example.com' });
    await verified('ada@example.com', 'grant-token');

    const result = await setPasswordWithGrant('grant-token', 'correct horse battery');
    if (result.status !== 'authenticated') throw new Error('expected authenticated');

    expect(result.session.userId).toBe(parentId);
    expect(await testPrisma().user.count()).toBe(1);
  });

  // Row three: this is password reset, and it is the same three screens.
  it('replaces a password that is already there', async () => {
    const parentId = await makeParent({ email: 'ada@example.com' });
    await makePassword(parentId, 'the old password');
    await verified('ada@example.com', 'grant-token');

    await setPasswordWithGrant('grant-token', 'the new password');

    expect((await signInWithPassword('ada@example.com', 'the old password')).status)
      .toBe('rejected');
    expect((await signInWithPassword('ada@example.com', 'the new password')).status)
      .toBe('authenticated');
  });

  it('claims the parent role on an account that never had one', async () => {
    const user = await testPrisma().user.create({
      data: { email: 'ada@example.com', name: 'Ada' },
    });
    await verified('ada@example.com', 'grant-token');

    await setPasswordWithGrant('grant-token', 'correct horse battery');

    const after = await testPrisma().user.findUnique({ where: { id: user.id } });
    expect(after?.role).toBe('parent');
  });

  it('refuses to put a password on a child', async () => {
    const parentId = await makeParent();
    const childId = await makeChild(parentId);
    await testPrisma().user.update({
      where: { id: childId },
      data: { email: 'kid@example.com' },
    });
    await verified('kid@example.com', 'grant-token');

    expect((await setPasswordWithGrant('grant-token', 'correct horse battery')).status)
      .toBe('invalid-grant');
    expect(await testPrisma().parentPassword.count()).toBe(0);
  });

  it('spends the grant, so it cannot be used twice', async () => {
    await verified('ada@example.com', 'grant-token');
    await setPasswordWithGrant('grant-token', 'correct horse battery');

    expect((await setPasswordWithGrant('grant-token', 'another password')).status)
      .toBe('invalid-grant');
  });

  it('rejects a grant that has run out', async () => {
    const issued = new Date('2026-09-05T10:00:00Z');
    const late = new Date('2026-09-05T11:00:00Z');
    await issueVerificationCode('ada@example.com', '123456', issued);
    await spendVerificationCode('ada@example.com', '123456', 'grant-token', issued);

    expect((await setPasswordWithGrant('grant-token', 'correct horse battery', late)).status)
      .toBe('invalid-grant');
  });

  it('rejects a password too short to be one', async () => {
    await verified('ada@example.com', 'grant-token');
    expect((await setPasswordWithGrant('grant-token', 'short')).status).toBe('rejected');
    expect(await testPrisma().parentPassword.count()).toBe(0);
  });

  // FIX 5: the guard that keeps a six-digit *code* from being spent as a
  // *grant* - `emailFromIdentifier` then `held.identifier !== grantIdentifier`
  // in `setPasswordWithGrant`. The design leans on this by name in three
  // places and nothing called `setPasswordWithGrant` with a code token before
  // this test.
  it('refuses a verification code presented as a grant', async () => {
    await issueVerificationCode('ada@example.com', '123456');

    const result = await setPasswordWithGrant('123456', 'correct horse battery');

    expect(result.status).toBe('invalid-grant');
    expect(await testPrisma().parentPassword.count()).toBe(0);
    expect(await testPrisma().user.count()).toBe(0);
  });

  // A refused password must not burn the grant - the grown-up is standing at
  // the screen and will type another one.
  it('leaves the grant alive after a refused password', async () => {
    await verified('ada@example.com', 'grant-token');
    await setPasswordWithGrant('grant-token', 'short');

    expect((await setPasswordWithGrant('grant-token', 'correct horse battery')).status)
      .toBe('authenticated');
  });
});
