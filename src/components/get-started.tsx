'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';

/**
 * The two ways in, on the landing page's top bar.
 *
 * Above `sm` they sit in the bar as peers — a grown-up signs in with Google, a
 * child types their code, and neither is the fallback for the other. On a phone
 * there is no room to say that: a four-character box read off another screen has
 * a floor on how small it can get, and beside a Google button it left the bar
 * crammed edge to edge. So on a phone the pair goes behind one "Get started"
 * button and opens as a panel underneath, where each gets a full row.
 *
 * It is the *same* pair either way, rendered once and re-laid-out in CSS rather
 * than duplicated behind a breakpoint — two copies of the code box is how the
 * two of them drift apart. `sm:contents` dissolves this wrapper at the wider
 * size so the bar's own flex row lays the children out directly.
 *
 * Closes on an outside pointerdown or Escape, never on blur — same as `Select`
 * and `ProfileMenu`, and for the same reason: a tap on a control inside moves
 * focus off the button first.
 */
export function GetStarted({ children }: { children: ReactNode }) {
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
    <div ref={menu} className="relative sm:contents">
      <button
        type="button"
        onClick={() => setOpen((was) => !was)}
        aria-expanded={open}
        className="no-select rounded-lg bg-(--color-brand) px-3 py-1.5 text-sm font-semibold whitespace-nowrap text-white transition active:scale-[0.98] sm:hidden"
      >
        Get started
      </button>

      <div
        className={`${open ? 'flex' : 'hidden'} absolute top-full right-0 z-20 mt-2 w-60 flex-col items-stretch gap-2 rounded-xl border border-(--color-line) bg-(--color-card) p-3 shadow-xl shadow-black/5 sm:static sm:mt-0 sm:flex sm:w-auto sm:flex-row sm:items-center sm:gap-4 sm:rounded-none sm:border-0 sm:bg-transparent sm:p-0 sm:shadow-none`}
      >
        {children}
      </div>
    </div>
  );
}
