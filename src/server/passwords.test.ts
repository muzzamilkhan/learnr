import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { startDatabase, stopDatabase, truncateAll, testPrisma } from './test-helpers/db';
import { makeChild, makeParent, makePassword } from './test-helpers/factories';
import { signInWithPassword } from './passwords';

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
