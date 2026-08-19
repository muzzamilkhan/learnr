'use client';

import Link from 'next/link';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { Avatar } from '@/lib/avatars';
import { shortYearLabel, type YearLevel } from '@/lib/curriculum';
import { ProfileFace } from '@/components/profile-face';
import { leaveShareAction } from '@/app/actions';

/** A child another parent has shared, as the server hands it over. */
export interface SharedChildRow {
  id: string;
  name: string;
  avatar: Avatar;
  /** The photograph the owning parent set - a viewer sees the face they chose. */
  photo: string | null;
  level: string | null;
  /** Who shared them. Null only if that parent has neither a name nor an email. */
  sharedBy: string | null;
}

const BUTTON =
  'no-select rounded-lg border border-(--color-line) px-3 py-1.5 text-sm font-semibold transition hover:border-(--color-brand) disabled:opacity-50';

/**
 * The children someone else has shared with this parent.
 *
 * Under their own heading, and with no action buttons at all - not disabled
 * ones. A card whose every control is greyed out is an invitation to tap things
 * that do nothing and a question ("why can't I?") the screen then has to answer;
 * a card with nothing but a name, a year and a way through to the report says
 * what this is on its own. Editing, codes and removal belong to the parent who
 * owns the profile, and there is no query in the app that would let them happen
 * from here even if a button existed.
 *
 * The one thing a viewer may do is stop being one, so "Leave" is the only
 * control - their grant is theirs to give up, and needing to ask the other
 * parent to revoke it would be the app making a family conversation compulsory.
 */
export function SharedChildren({ profiles }: { profiles: SharedChildRow[] }) {
  if (profiles.length === 0) return null;

  return (
    <section className="mt-6 space-y-3">
      <div>
        <h2 className="text-base font-semibold">Shared with you</h2>
        <p className="mt-0.5 text-sm text-(--color-ink-soft)">
          Another parent shares these children with you. You can read how they&rsquo;re going, and
          nothing else.
        </p>
      </div>
      <ul className="space-y-3">
        {profiles.map((child) => (
          <li key={child.id}>
            <SharedChildCard child={child} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function SharedChildCard({ child }: { child: SharedChildRow }) {
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const leave = () => {
    startTransition(async () => {
      await leaveShareAction(child.id);
      router.refresh();
    });
  };

  // Confirmed in the card rather than through `confirm()`, for the reasons the
  // remove button already is - and because this one needs to say the part a
  // browser dialog could not: getting back in means another invite.
  if (confirming) {
    return (
      <div className="rounded-xl border border-(--color-line) bg-(--color-card) p-4">
        <p className="text-base font-semibold">Stop following {child.name}?</p>
        <p className="mt-0.5 text-sm text-(--color-ink-soft)">
          Their progress disappears from your screens. Nothing happens to {child.name} - and
          getting it back means a new link from {child.sharedBy ?? 'their parent'}.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={leave}
            disabled={pending}
            className="no-select rounded-lg bg-(--color-wrong) px-3 py-1.5 text-sm font-semibold text-white transition active:scale-[0.98] disabled:opacity-50"
          >
            {pending ? 'Leaving…' : 'Stop following'}
          </button>
          <button
            type="button"
            onClick={() => setConfirming(false)}
            disabled={pending}
            className={BUTTON}
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-(--color-line) bg-(--color-card) p-4">
      <ProfileFace
        photo={child.photo}
        avatar={child.avatar}
        name={child.name}
        tone="bg-(--color-grape-soft) text-(--color-grape)"
      />
      <div className="min-w-0 flex-1">
        <p className="flex min-w-0 flex-wrap items-center gap-2">
          <span className="truncate text-base font-semibold">{child.name}</span>
          {/* Whose child this is, said on the card rather than only in the
              heading above it: a parent with children of their own is reading
              two families' names down one screen. */}
          <span className="rounded-full bg-(--color-grape-soft) px-2 py-0.5 text-xs font-semibold text-(--color-grape)">
            Shared by {child.sharedBy ?? 'another parent'}
          </span>
        </p>
        <p className="text-sm text-(--color-ink-soft)">
          {child.level ? shortYearLabel(child.level as YearLevel) : 'No level set'}
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Link href={`/progress?child=${child.id}`} className={BUTTON}>
          Progress
        </Link>
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className={`${BUTTON} text-(--color-ink-soft)`}
        >
          Leave
        </button>
      </div>
    </div>
  );
}
