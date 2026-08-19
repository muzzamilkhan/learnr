'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { AVATARS, DEFAULT_AVATAR, type Avatar } from '@/lib/avatars';
import { shortYearLabel, type YearLevel } from '@/lib/curriculum';
import { CODE_TTL_MS, isCodeLive, minutesLeft } from '@/lib/login-code';
import { targetOptions, type DailyTarget, type TargetKind } from '@/lib/rewards/target';
import { AvatarIcon } from '@/components/avatar-icon';
import { CopyIcon } from '@/components/copy-icon';
import { EditIcon } from '@/components/edit-icon';
import { EyeIcon } from '@/components/eye-icon';
import { KeyIcon } from '@/components/key-icon';
import { RemoveIcon } from '@/components/remove-icon';
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
  target: DailyTarget | null;
  code: string | null;
  codeExpiresAt: string | null;
}

/** Shared by every small button on the parent screens - a mouse target, not a thumb one. */
const BUTTON =
  'no-select rounded-lg border border-(--color-line) px-3 py-1.5 text-sm font-semibold transition hover:border-(--color-brand) disabled:opacity-50';
const PRIMARY =
  'no-select rounded-lg bg-(--color-brand) px-3 py-1.5 text-sm font-semibold text-white transition active:scale-[0.98] disabled:opacity-50';
/**
 * Square, and the same height as the buttons that still carry words, so a row of
 * both lines up. The label the glyph replaces moves to `aria-label` and `title`:
 * it is gone from the screen, not from the page.
 */
const ICON_BUTTON =
  'no-select flex h-[34px] w-[34px] items-center justify-center rounded-lg border border-(--color-line) transition hover:border-(--color-brand) disabled:opacity-50';
/** The same square, filled: the card's one primary action when it is a glyph too. */
const ICON_PRIMARY =
  'no-select flex h-[34px] w-[34px] items-center justify-center rounded-lg border border-transparent bg-(--color-brand) text-white transition active:scale-[0.98] disabled:opacity-50';

/**
 * Managing the child profiles: add, edit, remove, and hand out a login code.
 * This is the parent's second screen - their first is the report, because that
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
  // Not `children` - that name belongs to React, and passing this list under it
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

/**
 * A target in a parent's words. Short, because it sits in a row of short facts
 * beside the level - the same reason that row says "Year K" rather than
 * "Kindergarten".
 */
export const targetLabel = (target: DailyTarget): string =>
  `${target.value} ${target.kind === 'minutes' ? 'min' : 'questions'} a day`;

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
  // is unstyled, unreadable on an iPad, and - being synchronous - the one thing
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
            {child.level ? shortYearLabel(child.level as YearLevel) : 'No level set'}
            {/* Only ever an addition. A card reading "No daily goal" would put an
                absence on every card of every parent who never wanted one. */}
            {child.target ? ` · Goal: ${targetLabel(child.target)}` : ''}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {/* Three states, one button, and a glyph for each: a key issues a code
              the card doesn't have, an eye reveals the one it does. Revealing a
              live code must not issue a new one - the child may be halfway
              through typing the old one - so the two are not the same picture. */}
          {!code ? (
            <button
              type="button"
              onClick={issue}
              disabled={pending}
              aria-label={`Get a login code for ${child.name}`}
              title="Get code"
              className={ICON_PRIMARY}
            >
              <KeyIcon />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setShown((was) => !was)}
              aria-label={shown ? "Hide this child's login code" : "Show this child's login code"}
              title={shown ? 'Hide code' : 'Show code'}
              className={shown ? ICON_BUTTON : ICON_PRIMARY}
            >
              <EyeIcon off={shown} />
            </button>
          )}
          {/* The rest of the row is glyphs for the same reason: every card
              carries them and every card says the same thing with them, so the
              words were only ever taking up width. */}
          <button
            type="button"
            onClick={onEdit}
            aria-label={`Edit ${child.name}`}
            title={`Edit ${child.name}`}
            className={ICON_BUTTON}
          >
            <EditIcon />
          </button>
          <button
            type="button"
            onClick={() => setConfirming(true)}
            disabled={pending}
            aria-label={`Remove ${child.name}`}
            title={`Remove ${child.name}`}
            className={`${ICON_BUTTON} text-(--color-wrong) hover:border-(--color-wrong)`}
          >
            <RemoveIcon />
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
 * else on this screen is sized for a grown-up - it is the one thing here that
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
  /**
   * Which code the tick is for, rather than whether one is showing. A boolean
   * would need clearing when a new code replaces this one, and clearing it is
   * an effect that writes state from a prop change - the cascading render
   * `react-hooks/set-state-in-effect` exists to catch. Holding the value the
   * parent actually copied answers the same question by comparison, and a
   * regenerated code stops matching on the render that shows it.
   */
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const copied = copiedCode === code.value;

  // Best-effort, like playing a sound: an insecure context or a refused
  // permission rejects the write, and a code that can still be read off the
  // screen is not worth throwing over. The tick is only shown if it worked.
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code.value);
      setCopiedCode(code.value);
    } catch {
      // Nothing to say - the code is right there to be typed.
    }
  };

  // The tick goes back to the sheets after a moment, and the timer is cleared on
  // unmount and whenever a new code replaces this one.
  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopiedCode(null), 2000);
    return () => clearTimeout(timer);
  }, [copied]);

  // The clock belongs in an effect, not in render, and a code that ticks down
  // while a parent reads it should say so.
  useEffect(() => {
    const tick = () => setLeft(minutesLeft(new Date(code.expiresAt), new Date()));
    tick();
    const timer = setInterval(tick, 30_000);
    return () => clearInterval(timer);
  }, [code.expiresAt]);

  return (
    // The code is the thing on this panel, so it sits in the middle of it with
    // everything else stacked underneath. Copying is the other way it reaches
    // the child's device - read aloud across a room, or pasted into a message -
    // so that button goes right beside the digits, where the thing it copies is.
    // The letter-spacing puts a gap after the last character, so the copy button
    // is nudged back by half of it to sit where it looks equally spaced.
    <div className="mt-3 rounded-lg bg-(--color-brand-soft) px-4 py-3 text-center">
      <div className="flex items-center justify-center gap-2">
        <span className="text-3xl font-bold tracking-[0.3em] text-(--color-brand) -mr-[0.15em]">
          {code.value}
        </span>
        <button
          type="button"
          onClick={copy}
          aria-label={copied ? 'Code copied' : 'Copy code'}
          title={copied ? 'Copied' : 'Copy code'}
          className={`${ICON_BUTTON} ${copied ? 'text-(--color-right)' : ''}`}
        >
          <CopyIcon copied={copied} />
        </button>
      </div>

      <p className="mt-1 text-xs text-(--color-ink-soft)">
        {left === null
          ? 'Good once only.'
          : left > 0
            ? `${left} min left, and good once only.`
            : 'This one has run out - get a new code.'}
      </p>

      <button
        type="button"
        onClick={onRenew}
        disabled={pending}
        className={`${BUTTON} mt-2`}
      >
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
  // "none" is a real choice here rather than an absence, so the dropdown has
  // something to show for the child who has no goal.
  const [targetKind, setTargetKind] = useState<TargetKind | 'none'>(initial?.target?.kind ?? 'none');
  const [targetValue, setTargetValue] = useState<string>(
    String(initial?.target?.value ?? targetOptions(initial?.target?.kind ?? 'questions')[0]),
  );
  const [pending, startTransition] = useTransition();

  // When the kind changes the value has to move with it - twenty questions and
  // twenty minutes are not the same range.
  const changeKind = (next: string) => {
    const kind = next as TargetKind | 'none';
    setTargetKind(kind);
    if (kind !== 'none') setTargetValue(String(targetOptions(kind)[0]));
  };

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!name.trim()) return;

    startTransition(async () => {
      const saved = initial
        ? await updateChildAction(initial.id, name, avatar, level, targetKind, targetValue)
        : await createChildAction(name, avatar, level, targetKind, targetValue);
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
            options={levels.map((option) => ({ value: option, label: shortYearLabel(option) }))}
            onChange={setLevel}
          />
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label htmlFor="child-target-kind" className="mb-1 block text-sm font-semibold">
            Daily goal
          </label>
          <Select
            id="child-target-kind"
            size="md"
            value={targetKind}
            options={[
              { value: 'none', label: 'No goal' },
              { value: 'questions', label: 'Questions' },
              { value: 'minutes', label: 'Minutes' },
            ]}
            onChange={changeKind}
          />
        </div>

        {targetKind !== 'none' ? (
          <div>
            <label htmlFor="child-target-value" className="mb-1 block text-sm font-semibold">
              How many
            </label>
            <Select
              id="child-target-value"
              size="md"
              value={targetValue}
              options={targetOptions(targetKind).map((option) => ({
                value: String(option),
                label: String(option),
              }))}
              onChange={setTargetValue}
            />
          </div>
        ) : null}
      </div>

      {/* The one thing a parent needs told, and the reason the ceilings are where
          they are: a goal is a floor to reach, never a limit to stop at. */}
      <p className="text-sm text-(--color-ink-soft)">
        Optional. Reaching it is worth 10 stars, and nothing stops them carrying on past it.
      </p>

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
