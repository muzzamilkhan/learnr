'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { AVATARS, DEFAULT_AVATAR, type Avatar } from '@/lib/avatars';
import { yearLabel, type YearLevel } from '@/lib/curriculum';
import { AvatarIcon } from '@/components/avatar-icon';
import {
  createChildAction,
  issueLoginCodeAction,
  removeChildAction,
  updateChildAction,
} from '@/app/actions';

/** A child profile as the server hands it over. Dates are already serialised. */
export interface ChildRow {
  id: string;
  name: string;
  avatar: Avatar;
  level: string | null;
  code: string | null;
  codeExpiresAt: string | null;
}

/**
 * What a parent sees instead of the play screen. A parent doesn't practise — they
 * set up a profile per child and hand out codes — so there is no level picker and
 * no subject card here at all.
 *
 * A child's level is set here and nowhere else. That is the point of the managed
 * profile: the year is a decision the parent has made, so the child's own screen
 * shows the subjects for it and no dropdown to wander out of it.
 */
export function ParentDashboard({
  profiles,
  levels,
}: {
  // Not `children` — that name belongs to React, and passing this list under it
  // reads as nested JSX to every tool that looks at the file.
  profiles: ChildRow[];
  levels: YearLevel[];
}) {
  const [editing, setEditing] = useState<string | 'new' | null>(null);
  const router = useRouter();

  return (
    <section className="space-y-4">
      <ul className="space-y-4">
        {profiles.map((child) =>
          editing === child.id ? (
            <li key={child.id}>
              <ChildForm
                levels={levels}
                initial={child}
                onDone={() => {
                  setEditing(null);
                  router.refresh();
                }}
                onCancel={() => setEditing(null)}
              />
            </li>
          ) : (
            <li key={child.id}>
              <ChildCard child={child} onEdit={() => setEditing(child.id)} />
            </li>
          ),
        )}
      </ul>

      {editing === 'new' ? (
        <ChildForm
          levels={levels}
          initial={null}
          onDone={() => {
            setEditing(null);
            router.refresh();
          }}
          onCancel={() => setEditing(null)}
        />
      ) : (
        <button
          type="button"
          onClick={() => setEditing('new')}
          className="no-select w-full rounded-3xl border-2 border-dashed border-(--color-line) px-7 py-6 text-2xl font-semibold text-(--color-ink-soft) transition hover:border-(--color-brand) hover:text-(--color-brand)"
        >
          + Add child
        </button>
      )}

      {profiles.length === 0 && editing !== 'new' ? (
        <p className="text-lg text-(--color-ink-soft)">
          Add a profile for each child. You&rsquo;ll pick their level, and they sign in with a
          code rather than an account of their own.
        </p>
      ) : null}
    </section>
  );
}

/** How long a freshly issued code has left, rounded down — a parent needs the gist. */
function minutesLeft(expiresAt: string): number {
  return Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 60000));
}

function ChildCard({ child, onEdit }: { child: ChildRow; onEdit: () => void }) {
  const [code, setCode] = useState<string | null>(
    child.code && child.codeExpiresAt && minutesLeft(child.codeExpiresAt) > 0 ? child.code : null,
  );
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const getCode = () => {
    startTransition(async () => {
      const issued = await issueLoginCodeAction(child.id);
      if (issued) setCode(issued);
    });
  };

  const remove = () => {
    startTransition(async () => {
      await removeChildAction(child.id);
      router.refresh();
    });
  };

  return (
    <div className="rounded-3xl border-2 border-(--color-line) bg-(--color-card) p-6">
      <div className="flex flex-wrap items-center gap-5">
        <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-(--color-brand-soft) text-(--color-brand)">
          <AvatarIcon avatar={child.avatar} className="h-11 w-11" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-3xl font-semibold">{child.name}</p>
          <p className="text-lg text-(--color-ink-soft)">
            {child.level ? yearLabel(child.level as YearLevel) : 'No level set'}
          </p>
        </div>
        <div className="flex gap-3">
          <Link
            href={`/progress?child=${child.id}`}
            className="no-select rounded-2xl border-2 border-(--color-line) px-5 py-3 text-xl font-semibold transition hover:border-(--color-brand)"
          >
            Progress
          </Link>
          <button
            type="button"
            onClick={getCode}
            disabled={pending}
            className="no-select rounded-2xl bg-(--color-brand) px-5 py-3 text-xl font-semibold text-white transition active:scale-[0.98] disabled:opacity-50"
          >
            Get code
          </button>
          <button
            type="button"
            onClick={onEdit}
            className="no-select rounded-2xl border-2 border-(--color-line) px-5 py-3 text-xl font-semibold transition hover:border-(--color-brand)"
          >
            Edit
          </button>
          <button
            type="button"
            onClick={remove}
            disabled={pending}
            className="no-select rounded-2xl border-2 border-(--color-line) px-5 py-3 text-xl font-semibold text-(--color-wrong) transition hover:border-(--color-wrong) disabled:opacity-50"
          >
            Remove
          </button>
        </div>
      </div>

      {code ? (
        <p className="mt-5 rounded-2xl bg-(--color-brand-soft) px-5 py-4 text-center">
          <span className="block text-5xl font-bold tracking-[0.4em] text-(--color-brand)">
            {code}
          </span>
          <span className="mt-2 block text-base text-(--color-ink-soft)">
            Good for an hour, and once only. Getting another code stops this one working.
          </span>
        </p>
      ) : null}
    </div>
  );
}

function ChildForm({
  levels,
  initial,
  onDone,
  onCancel,
}: {
  levels: YearLevel[];
  initial: ChildRow | null;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [avatar, setAvatar] = useState<Avatar>(initial?.avatar ?? DEFAULT_AVATAR);
  const [level, setLevel] = useState<string>(initial?.level ?? levels[0] ?? 'K');
  const [pending, startTransition] = useTransition();

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!name.trim()) return;

    startTransition(async () => {
      const saved = initial
        ? await updateChildAction(initial.id, name, avatar, level)
        : await createChildAction(name, avatar, level);
      if (saved) onDone();
    });
  };

  return (
    <form
      onSubmit={submit}
      className="space-y-6 rounded-3xl border-2 border-(--color-brand) bg-(--color-card) p-6"
    >
      <div className="flex flex-wrap items-end gap-5">
        <div className="min-w-48 flex-1">
          <label htmlFor="child-name" className="mb-2 block text-xl font-semibold">
            Name
          </label>
          <input
            id="child-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={40}
            autoFocus
            className="w-full rounded-2xl border-2 border-(--color-line) px-5 py-3 text-2xl"
          />
        </div>
        <div>
          <label htmlFor="child-level" className="mb-2 block text-xl font-semibold">
            Level
          </label>
          <select
            id="child-level"
            value={level}
            onChange={(event) => setLevel(event.target.value)}
            className="no-select rounded-2xl border-2 border-(--color-line) bg-(--color-card) px-5 py-3 text-2xl font-medium"
          >
            {levels.map((option) => (
              <option key={option} value={option}>
                {yearLabel(option)}
              </option>
            ))}
          </select>
        </div>
      </div>

      <fieldset>
        <legend className="mb-3 text-xl font-semibold">Picture</legend>
        <div className="flex flex-wrap gap-3">
          {AVATARS.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setAvatar(option)}
              aria-label={option}
              aria-pressed={avatar === option}
              className={`no-select flex h-16 w-16 items-center justify-center rounded-2xl border-2 transition ${
                avatar === option
                  ? 'border-(--color-brand) bg-(--color-brand-soft) text-(--color-brand)'
                  : 'border-(--color-line) text-(--color-ink-soft) hover:border-(--color-brand)'
              }`}
            >
              <AvatarIcon avatar={option} className="h-10 w-10" />
            </button>
          ))}
        </div>
      </fieldset>

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={pending || !name.trim()}
          className="no-select rounded-2xl bg-(--color-brand) px-6 py-3 text-xl font-semibold text-white transition active:scale-[0.98] disabled:opacity-40"
        >
          {initial ? 'Save' : 'Add child'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="no-select rounded-2xl border-2 border-(--color-line) px-6 py-3 text-xl font-semibold transition hover:border-(--color-brand)"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
