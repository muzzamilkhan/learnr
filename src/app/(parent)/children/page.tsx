import { listLevels } from '@/content/catalog';
import { ParentDashboard, type ChildRow } from '@/components/parent-dashboard';
import { readParent } from '../parent';

// Per-parent, so it must never be prerendered and shared.
export const dynamic = 'force-dynamic';

/**
 * Setting up the children: profiles, levels and login codes. The report is the
 * parent's home screen; this is the screen they come to when something about a
 * profile needs changing.
 *
 * The header, nav and profile menu come from the layout, so a hop back to the
 * report replaces only what is below them.
 */
export default async function ChildrenPage() {
  const { profiles } = await readParent();

  if (profiles === null) {
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
    level: child.level,
    target: child.target,
    code: child.code,
    codeExpiresAt: child.codeExpiresAt?.toISOString() ?? null,
  }));

  return <ParentDashboard profiles={rows} levels={listLevels()} />;
}
