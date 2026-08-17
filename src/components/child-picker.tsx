'use client';

import { useRouter } from 'next/navigation';

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
    <label className="flex items-center gap-3">
      <span className="sr-only">Child</span>
      <select
        value={selected}
        onChange={(event) =>
          router.replace(`/progress?child=${event.target.value}&subject=${subject}`)
        }
        className="no-select rounded-2xl border-2 border-(--color-line) bg-(--color-card) px-5 py-3 text-xl font-medium"
      >
        {profiles.map((profile) => (
          <option key={profile.id} value={profile.id}>
            {profile.name}
          </option>
        ))}
      </select>
    </label>
  );
}
