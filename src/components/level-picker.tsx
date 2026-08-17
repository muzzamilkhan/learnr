'use client';

import { useState } from 'react';
import type { SubjectSummary } from '@/content/catalog';
import { yearLabel, type YearLevel } from '@/lib/curriculum';
import { saveSelectedLevelAction } from '@/app/actions';
import { SubjectCards } from '@/components/subject-cards';
import { Select } from '@/components/select';

/**
 * Level is the top-level choice: pick a year once, then see the subjects that
 * offer it. Switching level swaps the subjects in place rather than navigating,
 * so a child comparing years never leaves the screen.
 *
 * This is the *unmanaged* child's screen. A child whose profile a parent set up
 * gets `SubjectCards` on its own, with the year fixed and no dropdown to leave it.
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

  return (
    <>
      <div className="mb-10 flex items-center gap-4">
        <label htmlFor="level" className="text-2xl font-semibold">
          Level
        </label>
        <Select
          id="level"
          size="lg"
          value={level}
          options={levels.map((option) => ({ value: option, label: yearLabel(option) }))}
          onChange={(next) => choose(next as YearLevel)}
        />
      </div>

      <SubjectCards subjects={subjects} level={level} />
    </>
  );
}
