import { SignOutButton } from '@/components/auth-buttons';
import { ParentShell } from '@/components/parent-shell';
import { ProfileMenu } from '@/components/profile-menu';
import { readParent } from './parent';
import type { ReactNode } from 'react';

// Per-parent, so it must never be prerendered and shared.
export const dynamic = 'force-dynamic';

/**
 * The frame both parent screens share. It is a layout rather than something each
 * page draws for itself so that moving between the report and the profiles
 * changes only what differs: the logo, the profile menu and the nav stay mounted
 * instead of being torn down and rebuilt, which is what made the hop flicker.
 */
export default async function ParentLayout({ children }: { children: ReactNode }) {
  const { name, image, profiles } = await readParent();

  // A parent doesn't play, so there is no run of days and no stars to show -
  // both would be counting nothing.
  const menu = (
    <ProfileMenu name={name} image={image} streak={null} stars={null}>
      <SignOutButton />
    </ProfileMenu>
  );

  return (
    <ParentShell profiles={profiles ?? []} title="LearnR" menu={menu}>
      {children}
    </ParentShell>
  );
}
