'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { AVATARS, DEFAULT_AVATAR, type Avatar } from '@/lib/avatars';
import { yearLabel, type YearLevel } from '@/lib/curriculum';
import { CODE_TTL_MS, isCodeLive, minutesLeft } from '@/lib/login-code';
import { AvatarIcon } from '@/components/avatar-icon';
import { Select } from '@/components/select';
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

/** Shared by every small button on the parent screens — a mouse target, not a thumb one. */
const BUTTON =
  'no-select rounded-lg border border-(--color-line) px-3 py-1.5 text-sm font-semibold transition hover:border-(--color-brand) disabled:opacity-50';
const PRIMARY =
  'no-select rounded-lg bg-(--color-brand) px-3 py-1.5 text-sm font-semibold text-white transition active:scale-[0.98] disabled:opacity-50';

/**
 * Managing the child profiles: add, edit, remove, and hand out a login code.
 * This is the parent's second screen — their first is the report, because that
 * is what they open the app to look at once the profiles exist.
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
    <section className="space-y-3">
      <ul className="space-y-3">
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
          className="no-select w-full rounded-xl border border-dashed border-(--color-line) px-4 py-3 text-sm font-semibold text-(--color-ink-soft) transition hover:border-(--color-brand) hover:text-(--color-brand)"
        >
          + Add child
        </button>
      )}

      {profiles.length === 0 && editing !== 'new' ? (
        <p className="text-sm text-(--color-ink-soft)">
          Add a profile for each child. You&rsquo;ll pick their level, and they sign in with a
          code rather than an account of their own.
        </p>
      ) : null}
    </section>
  );
}

function ChildCard({ child, onEdit }: { child: ChildRow; onEdit: () => void }) {
  // Read once, at mount: a code's hour does not turn over while a parent looks
  // at the row, and reading the clock during render is not something a component
  // gets to do.
  const [code, setCode] = useState<{ value: string; expiresAt: number } | null>(() =>
    child.code && child.codeExpiresAt && isCodeLive(child.code, new Date(child.codeExpiresAt), new Date())
      ? { value: child.code, expiresAt: new Date(child.codeExpiresAt).getTime() }
      : null,
  );
  const [shown, setShown] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const issue = () => {
    startTransition(async () => {
      const issued = await issueLoginCodeAction(child.id);
      if (!issued) return;
      // A fresh code always starts its hour now, so the row does not need the
      // server to tell it when this one runs out.
      setCode({ value: issued, expiresAt: Date.now() + CODE_TTL_MS });
      setShown(true);
    });
  };

  const remove = () => {
    startTransition(async () => {
      await removeChildAction(child.id);
      router.refresh();
    });
  };

  // Asked for in the card rather than through `confirm()`: the browser dialog
  // is unstyled, unreadable on an iPad, and — being synchronous — the one thing
  // on this screen that can freeze it. It also cannot say what is actually
  // being lost, which is the only reason to ask at all.
  if (confirming) {
    return (
      <div className="rounded-xl border border-(--color-wrong) bg-(--color-card) p-4">
        <p className="text-base font-semibold">Remove {child.name}?</p>
        <p className="mt-0.5 text-sm text-(--color-ink-soft)">
          Their answers, progress and login code go too. This can&rsquo;t be undone.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={remove}
            disabled={pending}
            className="no-select rounded-lg bg-(--color-wrong) px-3 py-1.5 text-sm font-semibold text-white transition active:scale-[0.98] disabled:opacity-50"
          >
            {pending ? 'Removing…' : `Remove ${child.name}`}
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
    <div className="rounded-xl border border-(--color-line) bg-(--color-card) p-4">
      <div className="flex flex-wrap items-center gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-(--color-brand-soft) text-(--color-brand)">
          <AvatarIcon avatar={child.avatar} className="h-6 w-6" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-semibold">{child.name}</p>
          <p className="text-sm text-(--color-ink-soft)">
            {child.level ? yearLabel(child.level as YearLevel) : 'No level set'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={`/progress?child=${child.id}`} className={BUTTON}>
            Progress
          </Link>
          {/* Three states, one button. Revealing a live code must not issue a new
              one — the child may be halfway through typing the old one. */}
          {!code ? (
            <button type="button" onClick={issue} disabled={pending} className={PRIMARY}>
              Get code
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setShown((was) => !was)}
              className={shown ? BUTTON : PRIMARY}
            >
              {shown ? 'Hide code' : 'Show code'}
            </button>
          )}
          <button type="button" onClick={onEdit} className={BUTTON}>
            Edit
          </button>
          <button
            type="button"
            onClick={() => setConfirming(true)}
            disabled={pending}
            className={`${BUTTON} text-(--color-wrong) hover:border-(--color-wrong)`}
          >
            Remove
          </button>
        </div>
      </div>

      {code && shown ? (
        <CodePanel code={code} onRenew={issue} pending={pending} />
      ) : null}
    </div>
  );
}

/**
 * The code itself, big enough to read out across a room even though everything
 * else on this screen is sized for a grown-up — it is the one thing here that
 * gets copied by eye onto another device.
 */
function CodePanel({
  code,
  onRenew,
  pending,
}: {
  code: { value: string; expiresAt: number };
  onRenew: () => void;
  pending: boolean;
}) {
  const [left, setLeft] = useState<number | null>(null);

  // The clock belongs in an effect, not in render, and a code that ticks down
  // while a parent reads it should say so.
  useEffect(() => {
    const tick = () => setLeft(minutesLeft(new Date(code.expiresAt), new Date()));
    tick();
    const timer = setInterval(tick, 30_000);
    return () => clearInterval(timer);
  }, [code.expiresAt]);

  return (
    <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-lg bg-(--color-brand-soft) px-4 py-3">
      <div>
        <span className="block text-3xl font-bold tracking-[0.3em] text-(--color-brand)">
          {code.value}
        </span>
        <span className="mt-1 block text-xs text-(--color-ink-soft)">
          {left === null
            ? 'Good once only.'
            : left > 0
              ? `${left} min left, and good once only.`
              : 'This one has run out — get a new code.'}
        </span>
      </div>
      <button type="button" onClick={onRenew} disabled={pending} className={BUTTON}>
        New code
      </button>
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
      className="space-y-4 rounded-xl border border-(--color-brand) bg-(--color-card) p-4"
    >
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-48 flex-1">
          <label htmlFor="child-name" className="mb-1 block text-sm font-semibold">
            Name
          </label>
          <input
            id="child-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={40}
            autoFocus
            className="w-full rounded-lg border border-(--color-line) px-3 py-1.5 text-base"
          />
        </div>
        <div>
          <label htmlFor="child-level" className="mb-1 block text-sm font-semibold">
            Level
          </label>
          <Select
            id="child-level"
            size="md"
            value={level}
            options={levels.map((option) => ({ value: option, label: yearLabel(option) }))}
            onChange={setLevel}
          />
        </div>
      </div>

      <fieldset>
        <legend className="mb-2 text-sm font-semibold">Picture</legend>
        <div className="flex flex-wrap gap-2">
          {AVATARS.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setAvatar(option)}
              aria-label={option}
              aria-pressed={avatar === option}
              className={`no-select flex h-10 w-10 items-center justify-center rounded-lg border transition ${
                avatar === option
                  ? 'border-(--color-brand) bg-(--color-brand-soft) text-(--color-brand)'
                  : 'border-(--color-line) text-(--color-ink-soft) hover:border-(--color-brand)'
              }`}
            >
              <AvatarIcon avatar={option} className="h-6 w-6" />
            </button>
          ))}
        </div>
      </fieldset>

      <div className="flex gap-2">
        <button type="submit" disabled={pending || !name.trim()} className={PRIMARY}>
          {initial ? 'Save' : 'Add child'}
        </button>
        <button type="button" onClick={onCancel} className={BUTTON}>
          Cancel
        </button>
      </div>
    </form>
  );
}
