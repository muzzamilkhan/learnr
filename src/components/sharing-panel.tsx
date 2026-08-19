'use client';

import { useEffect, useState, useSyncExternalStore, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { subscribeToTheClock } from '@/components/clock';
import { nameList } from '@/lib/format';
import { sharePath, timeLeft } from '@/lib/share-link';
import { CopyIcon } from '@/components/copy-icon';
import { RemoveIcon } from '@/components/remove-icon';
import { Well } from '@/components/well';
import {
  cancelShareInviteAction,
  createShareInviteAction,
  revokeShareAction,
} from '@/app/actions';

/** A link that has been sent and not yet taken up. Dates arrive as ISO strings. */
export interface InviteRow {
  id: string;
  token: string;
  childIds: string[];
  expiresAt: string;
}

/** Someone with access, and the children they can see. */
export interface ViewerRow {
  id: string;
  name: string | null;
  email: string | null;
  image: string | null;
  children: { id: string; name: string }[];
}

const BUTTON =
  'no-select rounded-lg border border-(--color-line) px-3 py-1.5 text-sm font-semibold transition hover:border-(--color-brand) disabled:opacity-50';
const PRIMARY =
  'no-select rounded-lg bg-(--color-brand) px-3 py-1.5 text-sm font-semibold text-white transition active:scale-[0.98] disabled:opacity-50';
const ICON_BUTTON =
  'no-select flex h-[34px] w-[34px] items-center justify-center rounded-lg border border-(--color-line) transition hover:border-(--color-brand) disabled:opacity-50';

/**
 * Who else can see these children.
 *
 * Sharing is about people rather than about one child - a parent thinks "their
 * dad can see both of them", not "Ada is shared, and separately so is Bo" - so
 * it is one panel listing people, not a control repeated on every card. It is
 * also why a link is made by picking children rather than by opening a child.
 *
 * Everything here is read-only access to the report. There is deliberately no
 * setting to give more: the second grown-up cannot edit a profile, set a goal or
 * issue a login code, and that is a property of how the queries are scoped
 * rather than a switch left turned off.
 */
export function SharingPanel({
  profiles,
  invites,
  viewers,
}: {
  /** This parent's own children - the only ones a link may cover. */
  profiles: { id: string; name: string }[];
  /** `null` is a failed read, which must not render as "no links sent". */
  invites: InviteRow[] | null;
  viewers: ViewerRow[] | null;
}) {
  const [picking, setPicking] = useState(false);
  const [created, setCreated] = useState<string | null>(null);

  return (
    <Well
      title="Sharing"
      note="Send a link to another grown-up - their other parent, a grandparent, a tutor - and they can read how these children are going. They can't change anything."
    >
      <div className="space-y-4">
        {picking ? (
          <InviteForm
            profiles={profiles}
            onDone={(token) => {
              setCreated(token);
              setPicking(false);
            }}
            onCancel={() => setPicking(false)}
          />
        ) : (
          <button type="button" onClick={() => setPicking(true)} className={PRIMARY}>
            Invite someone
          </button>
        )}

        {/* The link just made, kept on screen until the parent navigates away:
            it is the whole point of the last three taps, and a link that
            disappeared into the list below would be one they have to find. */}
        {created ? <NewLink token={created} onDismiss={() => setCreated(null)} /> : null}

        {invites === null ? (
          <Failed what="links you've sent" />
        ) : invites.length > 0 ? (
          <PendingInvites invites={invites} profiles={profiles} />
        ) : null}

        {viewers === null ? (
          <Failed what="who has access" />
        ) : viewers.length > 0 ? (
          <Viewers viewers={viewers} />
        ) : (
          <p className="text-sm text-(--color-ink-soft)">Nobody else can see these children yet.</p>
        )}
      </div>
    </Well>
  );
}

/**
 * A failed read says so. An empty list and a database that didn't answer are
 * different facts, and "nobody has access" is the one of the two that must never
 * be guessed - a parent would read it as an answer about who can see their child.
 */
function Failed({ what }: { what: string }) {
  return (
    <p className="text-sm text-(--color-ink-soft)">Couldn&rsquo;t load {what} just now.</p>
  );
}

function InviteForm({
  profiles,
  onDone,
  onCancel,
}: {
  profiles: { id: string; name: string }[];
  onDone: (token: string) => void;
  onCancel: () => void;
}) {
  // One child is the common case, so it starts chosen when there is only one -
  // otherwise the first thing a parent with one child must do is tick their name.
  const [chosen, setChosen] = useState<string[]>(() =>
    profiles.length === 1 && profiles[0] ? [profiles[0].id] : [],
  );
  const [failed, setFailed] = useState(false);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const toggle = (id: string) =>
    setChosen((was) => (was.includes(id) ? was.filter((other) => other !== id) : [...was, id]));

  const create = () => {
    setFailed(false);
    startTransition(async () => {
      const token = await createShareInviteAction(chosen);
      if (!token) {
        setFailed(true);
        return;
      }
      onDone(token);
      router.refresh();
    });
  };

  return (
    <div className="rounded-lg border border-(--color-brand) p-3">
      <p className="text-sm font-semibold">Who can they see?</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {profiles.map((child) => {
          const on = chosen.includes(child.id);
          return (
            <button
              key={child.id}
              type="button"
              onClick={() => toggle(child.id)}
              aria-pressed={on}
              className={`no-select rounded-lg border px-3 py-1.5 text-sm font-semibold transition ${
                on
                  ? 'border-(--color-brand) bg-(--color-brand-soft) text-(--color-brand)'
                  : 'border-(--color-line) text-(--color-ink-soft) hover:border-(--color-brand)'
              }`}
            >
              {child.name}
            </button>
          );
        })}
      </div>

      <p className="mt-3 text-sm text-(--color-ink-soft)">
        The link works once and lasts a week. You can take access back at any time.
      </p>

      {failed ? (
        <p className="mt-2 text-sm text-(--color-wrong)">
          Couldn&rsquo;t make a link just now. Try again in a moment.
        </p>
      ) : null}

      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={create}
          disabled={pending || chosen.length === 0}
          className={PRIMARY}
        >
          {pending ? 'Making a link…' : 'Make a link'}
        </button>
        <button type="button" onClick={onCancel} disabled={pending} className={BUTTON}>
          Cancel
        </button>
      </div>
    </div>
  );
}

function NewLink({ token, onDismiss }: { token: string; onDismiss: () => void }) {
  return (
    <div className="rounded-lg bg-(--color-brand-soft) p-3">
      <p className="text-sm font-semibold text-(--color-brand)">Here&rsquo;s the link</p>
      <p className="mt-0.5 text-sm text-(--color-ink-soft)">
        Send it to them however you like. It lets one person in, and then it&rsquo;s spent.
      </p>
      <div className="mt-2 flex items-center gap-2">
        <ShareLink token={token} />
      </div>
      <button type="button" onClick={onDismiss} className={`${BUTTON} mt-3 bg-(--color-card)`}>
        Done
      </button>
    </div>
  );
}

/**
 * The link itself, with the copy button beside it - the login code's shape, and
 * for the same reason: copying is how this reaches the other person, so the
 * button belongs against the thing it copies. Selectable text as well as a
 * button, because a link that can only be copied by one tap is a link a parent
 * cannot check before they send it.
 */
function ShareLink({ token }: { token: string }) {
  const url = `${useOrigin()}${sharePath(token)}`;
  const [copied, setCopied] = useState(false);

  // Best-effort, like the login code's copy: an insecure context rejects the
  // write, and a link still on screen to be selected is not worth throwing over.
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      // Nothing to say - the link is right there to select.
    }
  };

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timer);
  }, [copied]);

  return (
    <>
      <code className="min-w-0 flex-1 truncate rounded-lg bg-(--color-card) px-3 py-1.5 text-xs">
        {url}
      </code>
      <button
        type="button"
        onClick={copy}
        aria-label={copied ? 'Link copied' : 'Copy link'}
        title={copied ? 'Copied' : 'Copy link'}
        className={`${ICON_BUTTON} bg-(--color-card) ${copied ? 'text-(--color-right)' : ''}`}
      >
        <CopyIcon copied={copied} />
      </button>
    </>
  );
}

/**
 * Where this page is being served from, which only the browser knows. Read
 * through `useSyncExternalStore` rather than in an effect, like the clock and the
 * narration switch: the server renders the path alone and the browser fills in
 * the origin, with no state written during a render either side of it.
 */
const subscribeToNothing = () => () => {};

function useOrigin(): string {
  return useSyncExternalStore(
    subscribeToNothing,
    () => window.location.origin,
    () => '',
  );
}

function PendingInvites({
  invites,
  profiles,
}: {
  invites: InviteRow[];
  profiles: { id: string; name: string }[];
}) {
  const now = useTickingClock();
  const names = new Map(profiles.map((child) => [child.id, child.name]));

  return (
    <div>
      <h3 className="text-sm font-semibold">Links waiting to be opened</h3>
      <ul className="mt-1 divide-y divide-(--color-line)">
        {invites.map((invite) => (
          <li key={invite.id} className="flex flex-wrap items-center gap-3 py-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">
                {nameList(
                  invite.childIds.map((id) => names.get(id)).filter((name) => name !== undefined),
                ) || 'No children left on this link'}
              </p>
              <p className="text-sm text-(--color-ink-soft)">
                {now === null
                  ? 'Not opened yet'
                  : `Not opened yet · ${timeLeft(new Date(invite.expiresAt), new Date(now))} left`}
              </p>
            </div>
            <ShareLink token={invite.token} />
            <CancelInvite invite={invite} />
          </li>
        ))}
      </ul>
    </div>
  );
}

function CancelInvite({ invite }: { invite: InviteRow }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  return (
    <button
      type="button"
      onClick={() =>
        startTransition(async () => {
          await cancelShareInviteAction(invite.id);
          router.refresh();
        })
      }
      disabled={pending}
      aria-label="Cancel this link"
      title="Cancel this link"
      className={`${ICON_BUTTON} text-(--color-wrong) hover:border-(--color-wrong)`}
    >
      <RemoveIcon />
    </button>
  );
}

function Viewers({ viewers }: { viewers: ViewerRow[] }) {
  return (
    <div>
      <h3 className="text-sm font-semibold">People with access</h3>
      <ul className="mt-1 divide-y divide-(--color-line)">
        {viewers.map((viewer) => (
          <li key={viewer.id} className="py-3">
            <ViewerRowItem viewer={viewer} />
          </li>
        ))}
      </ul>
    </div>
  );
}

function ViewerRowItem({ viewer }: { viewer: ViewerRow }) {
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const revoke = (childId?: string) =>
    startTransition(async () => {
      await revokeShareAction(viewer.id, childId);
      setConfirming(false);
      router.refresh();
    });

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">{viewer.name ?? viewer.email ?? 'Someone'}</p>
        <p className="truncate text-sm text-(--color-ink-soft)">
          {/* The children first, because that is what a parent is checking; the
              email second, because it is how they tell two people apart. */}
          Can see {nameList(viewer.children.map((child) => child.name))}
          {viewer.name && viewer.email ? ` · ${viewer.email}` : ''}
        </p>
      </div>

      {confirming ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-(--color-ink-soft)">Take back all access?</span>
          <button
            type="button"
            onClick={() => revoke()}
            disabled={pending}
            className="no-select rounded-lg bg-(--color-wrong) px-3 py-1.5 text-sm font-semibold text-white transition active:scale-[0.98] disabled:opacity-50"
          >
            {pending ? 'Removing…' : 'Remove'}
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
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          {/* One child at a time, when a person can see more than one: a parent
              who wants to narrow what someone sees should not have to revoke
              everything and send a fresh link. */}
          {viewer.children.length > 1
            ? viewer.children.map((child) => (
                <button
                  key={child.id}
                  type="button"
                  onClick={() => revoke(child.id)}
                  disabled={pending}
                  className={`${BUTTON} text-(--color-ink-soft)`}
                >
                  Stop sharing {child.name}
                </button>
              ))
            : null}
          <button
            type="button"
            onClick={() => setConfirming(true)}
            disabled={pending}
            aria-label={`Remove access for ${viewer.name ?? viewer.email ?? 'this person'}`}
            title="Remove access"
            className={`${ICON_BUTTON} text-(--color-wrong) hover:border-(--color-wrong)`}
          >
            <RemoveIcon />
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * The clock, for the week a link has left.
 *
 * Read through `subscribeToTheClock` like the streak and the day's total: only
 * the device knows what time it is there, the server renders nothing rather than
 * a number computed at UTC, and reading the clock during a render is not
 * something a component gets to do. `null` on the server, so the row says "not
 * opened yet" and gains the countdown once the browser has one.
 *
 * A link's week does not need a ticking display - it is rounded down to days for
 * all but its last hours, and a parent looking at this screen is deciding
 * whether to send another one, not watching it run out.
 */
function useTickingClock(): number | null {
  return useSyncExternalStore(
    subscribeToTheClock,
    // Rounded to the minute so the snapshot is the same value between renders -
    // a fresh `Date` would be a new object every read, which is the one thing
    // `useSyncExternalStore` cannot be given.
    () => Math.floor(Date.now() / 60_000) * 60_000,
    () => null,
  );
}
