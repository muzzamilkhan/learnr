import { listLevels } from '@/content/catalog';
import { ParentDashboard, type ChildRow } from '@/components/parent-dashboard';
import { SharedChildren, type SharedChildRow } from '@/components/shared-children';
import { SharingPanel, type InviteRow } from '@/components/sharing-panel';
import { listPendingInvites, listSharedViewers } from '@/server/sharing';
import type { PendingInvite } from '@/lib/dto';
import type { SharedViewer } from '@/lib/children';
import { readParent } from '../parent';

// Per-parent, so it must never be prerendered and shared.
export const dynamic = 'force-dynamic';

/**
 * Setting up the children: profiles, levels, login codes, and who else can see
 * them. The report is the parent's home screen; this is the screen they come to
 * when something about a profile needs changing.
 *
 * Three sections, in the order a parent thinks about them: the children they
 * own and can change, the children someone has shared with them (read-only, and
 * kept apart so the two never look interchangeable), and then who they have
 * shared their own with.
 *
 * The header, nav and profile menu come from the layout, so a hop back to the
 * report replaces only what is below them.
 */
export default async function ChildrenPage() {
  const { userId, profiles, viewable } = await readParent();

  if (profiles === null || viewable === null) {
    return (
      <p className="rounded-xl border border-(--color-line) bg-(--color-card) p-4 text-sm text-(--color-ink-soft)">
        Couldn&rsquo;t load your children just now. Try again in a moment.
      </p>
    );
  }

  const rows: ChildRow[] = profiles.map((child) => ({
    id: child.id,
    name: child.name,
    avatar: child.avatar,
    photo: child.photo,
    level: child.level,
    target: child.target,
    code: child.code,
    codeExpiresAt: child.codeExpiresAt?.toISOString() ?? null,
  }));

  const shared: SharedChildRow[] = viewable
    .filter((child) => child.access === 'viewer')
    .map((child) => ({
      id: child.id,
      name: child.name,
      avatar: child.avatar,
      photo: child.photo,
      level: child.level,
      sharedBy: child.sharedBy,
    }));

  // Only read for a parent with children of their own: with nobody to share
  // there is nothing either half could return, and the panel isn't drawn. The
  // two arrive together because one screen wants both, and a failed read makes
  // them both null - which the panel already draws as "couldn't load", where two
  // empty lists would have said "you have shared nothing".
  const sharing = rows.length ? await readSharing(userId) : { invites: [], viewers: [] };

  return (
    <>
      <ParentDashboard profiles={rows} levels={listLevels()} />

      <SharedChildren profiles={shared} />

      {rows.length ? (
        <div className="mt-6">
          <SharingPanel
            profiles={rows.map(({ id, name }) => ({ id, name }))}
            // Dates cross to the client as ISO strings, the way a login code's
            // expiry already does.
            invites={
              sharing?.invites.map<InviteRow>((invite) => ({
                id: invite.id,
                token: invite.token,
                childIds: invite.childIds,
                expiresAt: invite.expiresAt.toISOString(),
              })) ?? null
            }
            viewers={sharing?.viewers ?? null}
          />
        </div>
      ) : null}
    </>
  );
}

/**
 * The two halves of the sharing panel, in parallel and null together.
 *
 * Null together is the point: the panel draws null as "couldn't load", and one
 * successful empty list beside one failure would tell a parent they have shared
 * nothing. Two reads rather than one because they are two tables; one answer
 * because one screen asks the question.
 */
async function readSharing(
  parentId: string,
): Promise<{ invites: PendingInvite[]; viewers: SharedViewer[] } | null> {
  const [invites, viewers] = await Promise.all([
    listPendingInvites(parentId),
    listSharedViewers(parentId),
  ]);

  return invites === null || viewers === null ? null : { invites, viewers };
}
