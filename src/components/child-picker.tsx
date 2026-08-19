'use client';

import { useRouter } from 'next/navigation';

import { Select } from '@/components/select';

/** A child in the picker, and - if they are not this parent's - who shared them. */
export interface PickableChild {
  id: string;
  name: string;
  sharedBy?: string | null;
}

/**
 * Which child this screen is about. The choice goes in the URL rather than in
 * component state so a refresh keeps it - a parent who reloads should still be
 * looking at the same child.
 *
 * A child shared by another parent is named with who shared them, because two
 * families' children in one list is exactly where a name stops being enough to
 * tell them apart - and because it is worth being reminded whose child you are
 * reading about. Own children come first in the list the caller passes, so the
 * one this parent came for is never below someone else's.
 *
 * Not named `children`: that belongs to React, and a list of child profiles
 * under it reads as nested JSX to everything that looks at the file.
 */
export function ChildPicker({
  profiles,
  selected,
  subject,
}: {
  profiles: PickableChild[];
  selected: string;
  subject: string;
}) {
  const router = useRouter();

  if (profiles.length < 2) return null;

  return (
    <Select
      label="Child"
      value={selected}
      options={profiles.map((profile) => ({
        value: profile.id,
        label: profile.sharedBy ? `${profile.name} · shared by ${profile.sharedBy}` : profile.name,
      }))}
      onChange={(child) => router.replace(`/progress?child=${child}&subject=${subject}`)}
    />
  );
}
