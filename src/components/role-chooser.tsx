'use client';

import { useState, useTransition } from 'react';
import { chooseRoleAction } from '@/app/actions';

/**
 * The one screen shown to a signed-in account that hasn't said what it is. Two
 * cards, no default and no skip: the choice is permanent, so it is asked plainly
 * once rather than guessed at and corrected later.
 *
 * Every account that existed before this feature lands here on its next sign-in,
 * which is why there is no backfill in the migration - a person is a better source
 * for this than a heuristic over their data.
 */
export function RoleChooser() {
  const [pending, startTransition] = useTransition();
  const [chosen, setChosen] = useState<'parent' | 'child' | null>(null);

  const choose = (role: 'parent' | 'child') => {
    setChosen(role);
    startTransition(async () => {
      await chooseRoleAction(role);
    });
  };

  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
      {(
        [
          {
            role: 'parent' as const,
            title: "I'm a grown-up",
            blurb: 'Set up a profile for each child and give them a code to sign in with.',
          },
          {
            role: 'child' as const,
            title: 'This is for me',
            blurb: 'Pick a level and start practising.',
          },
        ]
      ).map((option) => (
        <button
          key={option.role}
          type="button"
          onClick={() => choose(option.role)}
          disabled={pending}
          className="no-select rounded-3xl border-2 border-(--color-line) bg-(--color-card) p-8 text-left transition active:scale-[0.98] hover:border-(--color-brand) disabled:opacity-60 aria-pressed:border-(--color-brand)"
          aria-pressed={chosen === option.role}
        >
          <span className="block text-3xl font-semibold">{option.title}</span>
          <span className="mt-2 block text-lg text-(--color-ink-soft)">{option.blurb}</span>
        </button>
      ))}
    </div>
  );
}
