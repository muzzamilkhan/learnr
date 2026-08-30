import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { startDatabase, stopDatabase, truncateAll } from './test-helpers/db';
import { makeChild, makeParent } from './test-helpers/factories';
import {
  acceptShareInvite,
  cancelShareInvite,
  createShareInvite,
  listPendingInvites,
  listSharedViewers,
  readShareInvite,
  readViewableChildren,
  revokeShare,
} from './sharing';
import { issueLoginCode, listChildren } from './accounts';

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

  // The level comes across, and the subjects sit beside it for the same reason:
  // a viewer reads the same profile the owner set, minus the code. Unlike the
  // code this is not withheld - what a child practises is the very thing the
  // report a viewer was given is about.
  it('carries the subjects their parent set', async () => {
    const owner = await makeParent();
    const childId = await makeChild(owner, { subjects: ['english'] });
    const viewer = await makeParent();

    const invite = await createShareInvite(owner, [childId]);
    await acceptShareInvite(invite!.token, viewer);

    expect((await readViewableChildren(viewer))?.[0]?.subjects).toEqual(['english']);
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

/**
 * `listChildren` is a parent's *own* children. Every parent screen reads the
 * viewable list instead - own plus shared - and serving the owned list there
 * would silently drop a shared child from the dashboard with nothing to show for
 * it. That is the whole reason the two exist separately.
 */
describe('readViewableChildren', () => {
  it('lists a parent-s own children', async () => {
    const parentId = await makeParent();
    await makeChild(parentId, { name: 'Mine' });

    expect((await readViewableChildren(parentId))?.map((child) => child.name)).toEqual(['Mine']);
  });

  it('includes a child shared with them, which listChildren does not', async () => {
    const owner = await makeParent();
    const shared = await makeChild(owner, { name: 'Shared' });
    const viewer = await makeParent();
    await makeChild(viewer, { name: 'Own' });

    const invite = await createShareInvite(owner, [shared]);
    await acceptShareInvite(invite!.token, viewer);

    expect((await listChildren(viewer))?.map((child) => child.name)).toEqual(['Own']);
    expect((await readViewableChildren(viewer))?.map((child) => child.name).sort())
      .toEqual(['Own', 'Shared']);
  });

  // `[]` is a parent with nobody yet and `null` is a read that broke. Every
  // screen here draws them differently, so the empty one must stay empty.
  it('is [] for a parent with no children, not null', async () => {
    expect(await readViewableChildren(await makeParent())).toEqual([]);
  });
});

/**
 * The page behind a link is public, and has to be: the whole point of the link
 * is that it reaches somebody who has no account here yet. They see who is
 * offering and which children, decide, and *then* sign in - so this read cannot
 * be behind the session that following the link is meant to produce. It stays
 * read-only either way: following your own link to check it must not spend it.
 */
describe('readShareInvite', () => {
  it('describes a live link so the page can ask "accept this?"', async () => {
    const owner = await makeParent({ name: 'Sam' });
    const childId = await makeChild(owner, { name: 'Ada' });

    const created = await createShareInvite(owner, [childId]);
    const invite = await readShareInvite(created!.token);

    expect(invite).toMatchObject({ live: true, ownerId: owner, ownerName: 'Sam' });
    expect(invite?.children.map((child) => child.name)).toEqual(['Ada']);
  });

  it('does not spend the link it describes', async () => {
    const owner = await makeParent();
    const childId = await makeChild(owner);
    const viewer = await makeParent();

    const created = await createShareInvite(owner, [childId]);
    await readShareInvite(created!.token);

    expect((await acceptShareInvite(created!.token, viewer)).ok).toBe(true);
  });

  it('answers null for a token nobody issued', async () => {
    expect(await readShareInvite('not-a-token')).toBeNull();
  });
});

/**
 * What the sharing panel draws: the links still outstanding, and everyone who
 * has taken one up. The two are read together because one screen wants both.
 */
describe('the sharing panel-s two lists', () => {
  it('start empty for a parent who has shared nothing', async () => {
    const parentId = await makeParent();

    expect(await listPendingInvites(parentId)).toEqual([]);
    expect(await listSharedViewers(parentId)).toEqual([]);
  });

  it('follow a link from sent, to accepted, to revoked', async () => {
    const owner = await makeParent();
    const childId = await makeChild(owner, { name: 'Shared' });
    const viewer = await makeParent();

    const invite = await createShareInvite(owner, [childId]);
    expect(await listPendingInvites(owner)).toHaveLength(1);

    await acceptShareInvite(invite!.token, viewer);
    // Accepted, so no longer outstanding - and now a viewer instead.
    expect(await listPendingInvites(owner)).toEqual([]);
    expect(await listSharedViewers(owner)).toHaveLength(1);

    expect(await revokeShare(owner, viewer)).toBe(true);
    expect(await listSharedViewers(owner)).toEqual([]);
  });

  it('will not let a stranger cancel a link they did not send', async () => {
    const owner = await makeParent();
    const childId = await makeChild(owner);
    const stranger = await makeParent();

    await createShareInvite(owner, [childId]);
    const [pending] = (await listPendingInvites(owner))!;

    expect(await cancelShareInvite(stranger, pending.id)).toBe(false);
    expect(await listPendingInvites(owner)).toHaveLength(1);
  });
});
