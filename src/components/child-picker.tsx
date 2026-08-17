'use client';

import { useRouter } from 'next/navigation';

import { Select } from '@/components/select';

/**
 * Which child this screen is about. The choice goes in the URL rather than in
 * component state so a refresh keeps it — a parent who reloads should still be
 * looking at the same child.
 *
 * Not named `children`: that belongs to React, and a list of child profiles
 * under it reads as nested JSX to everything that looks at the file.
 */
export function ChildPicker({
  profiles,
  selected,
  subject,
}: {
  profiles: { id: string; name: string }[];
  selected: string;
  subject: string;
}) {
  const router = useRouter();

  if (profiles.length < 2) return null;

  return (
    <Select
      label="Child"
      value={selected}
      options={profiles.map((profile) => ({ value: profile.id, label: profile.name }))}
      onChange={(child) => router.replace(`/progress?child=${child}&subject=${subject}`)}
    />
  );
}
