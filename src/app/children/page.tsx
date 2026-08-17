import { redirect } from 'next/navigation';
import { auth, isAuthConfigured } from '@/auth';
import { listLevels } from '@/content/catalog';
import { SignOutButton } from '@/components/auth-buttons';
import { ParentDashboard, type ChildRow } from '@/components/parent-dashboard';
import { ParentShell } from '@/components/parent-shell';
import { ProfileMenu } from '@/components/profile-menu';
import { listChildren, readAccount } from '@/lib/accounts';

// Per-parent, so it must never be prerendered and shared.
export const dynamic = 'force-dynamic';

/**
 * Setting up the children: profiles, levels and login codes. The report is the
 * parent's home screen; this is the screen they come to when something about a
 * profile needs changing.
 */
export default async function ChildrenPage() {
  const session = isAuthConfigured ? await auth() : null;
  const userId = session?.user?.id;
  if (!userId) redirect('/');

  // A child must not reach this screen, and neither must an account that has
  // not said what kind it is yet.
  const account = await readAccount(userId);
  if (account?.role !== 'parent') redirect('/');

  const profiles = await listChildren(userId);

  // A parent doesn't play, so there are no stars to show — they would be
  // counting nothing.
  const menu = (
    <ProfileMenu
      name={session?.user?.name ?? null}
      image={session?.user?.image ?? null}
      stars={null}
    >
      <SignOutButton />
    </ProfileMenu>
  );

  if (profiles === null) {
    return (
      <ParentShell title="Children" current="children" menu={menu}>
        <p className="rounded-xl border border-(--color-line) bg-(--color-card) p-4 text-sm text-(--color-ink-soft)">
          Couldn&rsquo;t load your children just now. Try again in a moment.
        </p>
      </ParentShell>
    );
  }

  const rows: ChildRow[] = profiles.map((child) => ({
    id: child.id,
    name: child.name,
    avatar: child.avatar,
    level: child.level,
    code: child.code,
    codeExpiresAt: child.codeExpiresAt?.toISOString() ?? null,
  }));

  return (
    <ParentShell
      title="Children"
      subtitle="Profiles, levels and login codes."
      current="children"
      menu={menu}
    >
      <ParentDashboard profiles={rows} levels={listLevels()} />
    </ParentShell>
  );
}
