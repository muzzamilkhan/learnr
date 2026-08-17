'use client';

import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import Image from 'next/image';
import { formatCount } from '@/lib/format';
import { currentStreak, type PlayStreak } from '@/lib/rewards/streak';
import { FlameIcon, StarIcon } from './star-icon';

/**
 * The one thing in the top corner: the run of days, the stars collected, whose
 * account this is, and — behind a tap — the way out. The same control on the
 * home screen and the play screen, so a child never has to look in two places
 * for the two numbers.
 *
 * Days first, then stars: the run is the thing that lapses if they stop, and it
 * is what the home screen is trying to say. Neither is a score — the star total
 * only ever goes up, in whole rounds, and nothing a wrong answer does takes
 * anything off either of them.
 */

/**
 * Nothing to subscribe to: the day only turns over at midnight, and a child
 * whose screen has been open since yesterday will reload it long before the
 * stale number matters. Stable identity, so the store is never resubscribed.
 */
const subscribeToTheClock = () => () => {};

interface Props {
  name: string | null;
  image: string | null;
  /**
   * As stored, and null for a parent — they don't play, so a run of days on
   * their account is counting nothing. Whether a run is still live depends on
   * the child's clock, not the server's.
   */
  streak: PlayStreak | null;
  /**
   * Stars collected in total, and null for a parent — they don't play, so a pile
   * of stars on their account would be counting nothing.
   */
  stars: number | null;
  /** The sign-out form, built on the server so it stays a server action. */
  children: ReactNode;
}

export function ProfileMenu({ name, image, streak, stars, children }: Props) {
  const [open, setOpen] = useState(false);
  const menu = useRef<HTMLDivElement>(null);

  /**
   * Whether the run is still alive is a question only the browser can answer —
   * the server has no idea which day it is where the child is sitting. So the
   * server renders the stored number and the client corrects it: a streak that
   * quietly ended last week must not still be claimed, and it must not be a
   * hydration mismatch either.
   *
   * The snapshot is the same number all day, so re-reading it costs nothing.
   */
  const days = useSyncExternalStore(
    subscribeToTheClock,
    () => (streak ? currentStreak(streak, Date.now(), -new Date().getTimezoneOffset()) : 0),
    () => streak?.days ?? 0,
  );

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: PointerEvent) => {
      if (!menu.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };

    window.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={menu} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((was) => !was)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={name ? `Account: ${name}` : 'Account'}
        // The counts sit inside the button rather than beside it: they double the
        // target, and there is nothing a child could tap here by mistake.
        className={`no-select flex items-center gap-2 rounded-full border-2 border-(--color-line) bg-(--color-card) py-1.5 pr-1.5 ${streak || stars !== null ? 'pl-3' : 'pl-1.5'} transition active:scale-95`}
      >
        {/* A lapsed run shows nothing rather than a zero — a 0 beside a flame
            reads as a telling-off, and the child is here to start a new one. */}
        {streak && days > 0 ? (
          <span
            className="flex items-center gap-1 text-lg font-bold text-(--color-flame) tabular-nums"
            title={`${formatCount(days)} day${days === 1 ? '' : 's'} in a row`}
          >
            <FlameIcon className="h-5 w-5" />
            {formatCount(days)}
          </span>
        ) : null}

        {stars === null ? null : (
          <span
            className="flex items-center gap-1 text-lg font-bold text-(--color-star) tabular-nums"
            title={`${formatCount(stars)} star${stars === 1 ? '' : 's'} collected`}
          >
            <StarIcon filled className="h-5 w-5" />
            {formatCount(stars)}
          </span>
        )}
        <Avatar name={name} image={image} />
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute right-0 z-20 mt-2 w-60 space-y-1 rounded-2xl border-2 border-(--color-line) bg-(--color-card) p-2 shadow-xl shadow-black/5"
        >
          {name ? (
            <p className="truncate px-3 pt-1 text-base text-(--color-ink-soft)">{name}</p>
          ) : null}

          {/* The total is on the button itself, so it is not repeated in here —
              behind the tap there is only the way out. */}
          <div className={name ? 'border-t-2 border-(--color-line) pt-1' : ''}>{children}</div>
        </div>
      ) : null}
    </div>
  );
}

/**
 * Google's picture when there is one. There often is not — a family account, or
 * a child added to one — so the fallback has to look deliberate rather than
 * broken: their initial, or a plain silhouette when there is not even a name.
 */
function Avatar({ name, image }: { name: string | null; image: string | null }) {
  const initial = name?.trim()?.[0]?.toUpperCase();

  if (image) {
    return (
      <Image
        src={image}
        alt=""
        width={40}
        height={40}
        className="h-10 w-10 rounded-full object-cover"
      />
    );
  }

  return (
    <span className="flex h-10 w-10 items-center justify-center rounded-full bg-(--color-brand-soft) text-lg font-bold text-(--color-brand)">
      {initial ?? (
        <svg
          viewBox="0 0 24 24"
          fill="currentColor"
          aria-hidden="true"
          className="h-6 w-6 opacity-70"
        >
          <path d="M12 12a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9Zm0 1.8c-4 0-7.5 2.2-7.5 5v.7c0 .8.7 1.5 1.5 1.5h12c.8 0 1.5-.7 1.5-1.5v-.7c0-2.8-3.5-5-7.5-5Z" />
        </svg>
      )}
    </span>
  );
}
