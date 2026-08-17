'use client';

import { useRouter } from 'next/navigation';

/**
 * Which subject this screen is about. A dropdown rather than tabs: maths is the
 * only subject today, and a row of one tab is a label pretending to be a
 * control. A dropdown with one option is honestly a dropdown, and reads the
 * same the day a second subject ships.
 *
 * Like `ChildPicker`, the choice goes in the URL so a refresh keeps it.
 */
export function SubjectPicker({
  subjects,
  selected,
  child,
}: {
  subjects: string[];
  selected: string;
  child: string;
}) {
  const router = useRouter();

  if (subjects.length === 0) return null;

  return (
    <label className="flex items-center gap-2">
      <span className="sr-only">Subject</span>
      <select
        value={selected}
        onChange={(event) =>
          router.replace(`/progress?child=${child}&subject=${event.target.value}`)
        }
        className="no-select rounded-lg border border-(--color-line) bg-(--color-card) px-3 py-1.5 text-sm font-medium capitalize"
      >
        {subjects.map((subject) => (
          <option key={subject} value={subject} className="capitalize">
            {subject}
          </option>
        ))}
      </select>
    </label>
  );
}
