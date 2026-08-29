import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { startDatabase, stopDatabase, truncateAll } from './test-helpers/db';
import { makeChild, makeParent } from './test-helpers/factories';
import {
  acceptShareInvite,
  createShareInvite,
  readViewableChildren,
  revokeShare,
} from './sharing';
import { issueLoginCode } from './accounts';

beforeAll(startDatabase);
afterAll(stopDatabase);
beforeEach(truncateAll);

describe('a share invite', () => {
  it('is spent at acceptance, so one link admits one person', async () => {
    const owner = await makeParent();
    const childId = await makeChild(owner);
    const viewer = await makeParent();
    const other = await makeParent();

    const invite = await createShareInvite(owner, [childId]);
    expect(invite?.token).toBeTypeOf('string');

    const first = await acceptShareInvite(invite!.token, viewer);
    expect(first.ok).toBe(true);

    const second = await acceptShareInvite(invite!.token, other);
    expect(second.ok).toBe(false);
  });

  it('grants the viewer a read of that child and nothing else', async () => {
    const owner = await makeParent();
    const shared = await makeChild(owner, { name: 'Shared' });
    await makeChild(owner, { name: 'Private' });
    const viewer = await makeParent();

    const invite = await createShareInvite(owner, [shared]);
    await acceptShareInvite(invite!.token, viewer);

    const viewable = await readViewableChildren(viewer);
    expect(viewable?.map((child) => child.name)).toEqual(['Shared']);
  });

  it('cannot be created over a child the issuer does not own', async () => {
    const owner = await makeParent();
    const stranger = await makeParent();
    const childId = await makeChild(owner);

    const invite = await createShareInvite(stranger, [childId]);
    const viewer = await makeParent();

    // The issuer owns nothing, so either the link is refused outright or it
    // grants nothing when accepted. Both are correct; neither may leak a child.
    if (invite) {
      await acceptShareInvite(invite.token, viewer);
      expect(await readViewableChildren(viewer)).toEqual([]);
    } else {
      expect(invite).toBeNull();
    }
  });
});

describe('a shared child', () => {
  it('never carries their login code to a viewer', async () => {
    const owner = await makeParent();
    const childId = await makeChild(owner);
    const viewer = await makeParent();

    await issueLoginCode(owner, childId);

    const invite = await createShareInvite(owner, [childId]);
    await acceptShareInvite(invite!.token, viewer);

    const viewable = await readViewableChildren(viewer);

    // A viewer holding the code could sign in as the child.
    expect(viewable?.[0]?.code).toBeNull();
    expect(viewable?.[0]?.codeExpiresAt).toBeNull();
  });
});

describe('revokeShare', () => {
  it('takes the read back', async () => {
    const owner = await makeParent();
    const childId = await makeChild(owner);
    const viewer = await makeParent();

    const invite = await createShareInvite(owner, [childId]);
    await acceptShareInvite(invite!.token, viewer);

    expect(await revokeShare(owner, viewer, childId)).toBe(true);
    expect(await readViewableChildren(viewer)).toEqual([]);
  });
});
