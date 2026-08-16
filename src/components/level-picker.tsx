'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { SubjectSummary } from '@/content/catalog';
import { yearLabel, type YearLevel } from '@/lib/curriculum';
import { saveSelectedLevelAction } from '@/app/actions';

/**
 * Level is the top-level choice: pick a year once, then see the subjects that
 * offer it. Switching level swaps the subjects in place rather than navigating,
 * so a child comparing years never leaves the screen.
 */
export function LevelPicker({
  subjects,
  levels,
  initialLevel,
}: {
  subjects: SubjectSummary[];
  levels: YearLevel[];
  initialLevel: YearLevel;
}) {
  const [level, setLevel] = useState<YearLevel>(initialLevel);

  const choose = (next: YearLevel) => {
    setLevel(next);
    // Best effort: the pick has already taken effect on screen.
    void saveSelectedLevelAction(next);
  };

  const offered = subjects
    .map((subject) => ({
      subject: subject.subject,
      topics: subject.levels.find((l) => l.level === level)?.topics ?? [],
    }))
    .filter((subject) => subject.topics.length > 0);

  return (
    <>
      <div className="mb-10 flex items-center gap-4">
        <label htmlFor="level" className="text-2xl font-semibold">
          Level
        </label>
        <select
          id="level"
          value={level}
          onChange={(event) => choose(event.target.value as YearLevel)}
          className="no-select rounded-2xl border-2 border-(--color-line) bg-(--color-card) px-5 py-3 text-2xl font-medium"
        >
          {levels.map((option) => (
            <option key={option} value={option}>
              {yearLabel(option)}
            </option>
          ))}
        </select>
      </div>

      <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {offered.map((subject) => (
          <li key={subject.subject}>
            <Link
              href={`/play?subject=${subject.subject}&level=${level}`}
              className="no-select block rounded-3xl border-2 border-(--color-line) bg-(--color-card) p-7 transition active:scale-[0.98] hover:border-(--color-brand)"
            >
              <span className="block text-3xl font-semibold capitalize">{subject.subject}</span>
              <span className="mt-2 block text-lg text-(--color-ink-soft)">
                {subject.topics.join(' · ')}
              </span>
            </Link>
          </li>
        ))}
      </ul>

      {offered.length === 0 ? (
        <p className="text-xl text-(--color-ink-soft)">
          Nothing to practice in {yearLabel(level)} yet.
        </p>
      ) : null}
    </>
  );
}
