'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import Image from 'next/image';
import { StarIcon } from './star-icon';

/**
 * The one thing in the top corner: how many stars the child has collected, whose
 * account this is, and — behind a tap — the way out.
 *
 * The total is a badge and never a score: it only ever goes up, it moves in
 * whole stars a round at a time, and there is nothing a wrong answer takes off
 * it. The run of days is not here at all — it belongs on the home screen, where
 * a child is deciding whether to practise (`StreakBadge`).
 */

interface Props {
  name: string | null;
  image: string | null;
  /**
   * Stars collected in total, and null for a parent — they don't play, so a pile
   * of stars on their account would be counting nothing.
   */
  stars: number | null;
  /** The sign-out form, built on the server so it stays a server action. */
  children: ReactNode;
}

export function ProfileMenu({ name, image, stars, children }: Props) {
  const [open, setOpen] = useState(false);
  const menu = useRef<HTMLDivElement>(null);

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
        // The star count sits inside the button rather than beside it: it doubles
        // the target, and there is nothing a child could tap here by mistake.
        className={`no-select flex items-center gap-2 rounded-full border-2 border-(--color-line) bg-(--color-card) py-1.5 pr-1.5 ${stars === null ? 'pl-1.5' : 'pl-3'} transition active:scale-95`}
      >
        {stars === null ? null : (
          <span
            className="flex items-center gap-1 text-lg font-bold text-(--color-star) tabular-nums"
            title={`${stars} star${stars === 1 ? '' : 's'} collected`}
          >
            <StarIcon filled className="h-5 w-5" />
            {stars}
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
